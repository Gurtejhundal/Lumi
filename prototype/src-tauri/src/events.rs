use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

pub const EVENT_CHANNEL: &str = "nox://event";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum RuntimeEvent {
    SessionStarted { session_id: String, cwd: Option<String> },
    Thinking { session_id: String, summary: Option<String> },
    FileRead { session_id: String, path: String },
    FileEdit { session_id: String, path: String },
    CommandStarted { session_id: String, command: String },
    CommandFinished { session_id: String, exit_code: i32 },
    PermissionRequested { session_id: String, request_id: String, label: String },
    PermissionResolved { session_id: String, request_id: String, decision: Decision },
    SessionFinished { session_id: String, outcome: Outcome },
    Volume { level: u8, muted: bool },
    Brightness { level: u8 },
    Battery { percentage: f64, charging: bool, critical: bool },
    Bluetooth { connected: bool, device: Option<String> },
    Network { connected: bool, ssid: Option<String> },
    Privacy { kind: PrivacyKind, active: bool },
    Media { player: String, title: String, artist: Option<String>, art_url: Option<String>, playback: Playback },
    AssistantStatus { request_id: String, status: String },
    AssistantResponse { request_id: String, text: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision { Allow, Deny }

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome { Success, Failed, Cancelled }

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PrivacyKind { Microphone, Camera }

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Playback { Playing, Paused, Stopped }

pub fn emit(app: &AppHandle, event: RuntimeEvent) {
    if let Err(error) = app.emit(EVENT_CHANNEL, event) {
        eprintln!("Unable to forward Nox event to the frontend: {error}");
    }
}
