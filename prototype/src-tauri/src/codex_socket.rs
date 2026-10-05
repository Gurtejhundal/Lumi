use std::{collections::HashMap, path::PathBuf, sync::{Arc, Mutex}};

use serde::Serialize;
use tauri::AppHandle;
use tokio::{io::{AsyncBufReadExt, AsyncWriteExt, BufReader}, net::{UnixListener, UnixStream}, sync::{mpsc, oneshot}};

use crate::events::{emit, Decision, RuntimeEvent};

#[derive(Clone, Default)]
pub struct PendingPermissions(pub Arc<Mutex<HashMap<String, oneshot::Sender<Decision>>>>);

#[derive(Clone, Default)]
pub struct AssistantBridge(pub Arc<Mutex<Option<mpsc::Sender<BridgeMessage>>>>);

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum BridgeMessage {
    PermissionResolved { request_id: String, decision: Decision },
    QuickAssistant {
        request_id: String,
        prompt: String,
        session_id: Option<String>,
        file_path: Option<String>,
    },
    FileAttach { path: String },
}

pub fn socket_path() -> Option<PathBuf> {
    std::env::var_os("XDG_RUNTIME_DIR").map(|root| PathBuf::from(root).join("nox-island").join("codex-events.sock"))
}

pub fn start(app: AppHandle, pending: PendingPermissions, bridge: AssistantBridge) {
    tauri::async_runtime::spawn(async move {
        let Some(path) = socket_path() else {
            eprintln!("XDG_RUNTIME_DIR is unavailable; Codex event bridge is disabled");
            return;
        };
        let Some(parent) = path.parent() else { return; };
        if tokio::fs::create_dir_all(parent).await.is_err() { return; }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = tokio::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700)).await;
        }
        if path.exists() && std::fs::remove_file(&path).is_err() { return; }
        let Ok(listener) = UnixListener::bind(&path) else { return; };
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }

        loop {
            let Ok((stream, _)) = listener.accept().await else { continue; };
            let app = app.clone();
            let pending = pending.clone();
            let bridge = bridge.clone();
            tauri::async_runtime::spawn(async move { handle_connection(app, pending, bridge, stream).await; });
        }
    });
}

pub fn resolve(pending: &PendingPermissions, request_id: &str, decision: Decision) -> Result<(), String> {
    let sender = pending.0.lock().map_err(|_| "permission registry is unavailable")?.remove(request_id);
    let Some(sender) = sender else { return Err("permission request is no longer pending".into()); };
    sender.send(decision).map_err(|_| "permission bridge disconnected".into())
}

pub async fn request_assistant(
    bridge: &AssistantBridge,
    request_id: String,
    prompt: String,
    session_id: Option<String>,
    file_path: Option<String>,
) -> Result<(), String> {
    let sender = bridge.0.lock().map_err(|_| "assistant bridge is unavailable")?.clone();
    let Some(sender) = sender else { return Err("No local Codex bridge is connected".into()); };
    sender.send(BridgeMessage::QuickAssistant { request_id, prompt, session_id, file_path })
        .await
        .map_err(|_| "The local Codex bridge disconnected".into())
}

pub async fn attach_file(bridge: &AssistantBridge, path: String) -> Result<(), String> {
    let sender = bridge.0.lock().map_err(|_| "assistant bridge is unavailable")?.clone();
    let Some(sender) = sender else { return Err("No local Codex bridge is connected".into()); };
    sender.send(BridgeMessage::FileAttach { path }).await
        .map_err(|_| "The local Codex bridge disconnected".into())
}

async fn handle_connection(app: AppHandle, pending: PendingPermissions, bridge: AssistantBridge, stream: UnixStream) {
    let (reader, mut writer) = stream.into_split();
    let (outbound, mut replies) = mpsc::channel::<BridgeMessage>(16);
    if let Ok(mut active) = bridge.0.lock() { *active = Some(outbound.clone()); }
    let writer_task = tauri::async_runtime::spawn(async move {
        while let Some(reply) = replies.recv().await {
            let Ok(serialized) = serde_json::to_string(&reply) else { continue; };
            if writer.write_all(serialized.as_bytes()).await.is_err() { break; }
            if writer.write_all(b"\n").await.is_err() { break; }
        }
    });

    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let Ok(event) = serde_json::from_str::<RuntimeEvent>(&line) else { continue; };
        if let RuntimeEvent::PermissionRequested { request_id, .. } = &event {
            let request_id = request_id.clone();
            let (sender, receiver) = oneshot::channel();
            if let Ok(mut entries) = pending.0.lock() { entries.insert(request_id.clone(), sender); }
            emit(&app, event);
            let Ok(decision) = receiver.await else { continue; };
            if outbound.send(BridgeMessage::PermissionResolved { request_id, decision }).await.is_err() { break; }
        } else {
            emit(&app, event);
        }
    }
    if let Ok(mut active) = bridge.0.lock() { *active = None; }
    writer_task.abort();
}
