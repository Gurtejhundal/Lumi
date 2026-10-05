mod codex_socket;
mod events;
mod mpris;
mod system_hud;

use serde::{Deserialize, Serialize};
use tauri::{LogicalSize, Manager, PhysicalPosition, State, WebviewWindow};

use codex_socket::{AssistantBridge, PendingPermissions};
use events::Decision;
use mpris::MprisState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayCapabilities {
    session: &'static str,
    placement: &'static str,
    supports_region_input: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DroppedFileInfo {
    path: String,
    name: String,
    kind: String,
    bytes: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssistantContext {
    session_id: Option<String>,
    file_path: Option<String>,
}

fn center_on_primary_monitor(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()?.or(window.current_monitor()?) else {
        return Ok(());
    };
    let monitor_size = monitor.size();
    let window_size = window.outer_size()?;
    let x = monitor_size.width.saturating_sub(window_size.width) / 2;
    window.set_position(PhysicalPosition::new(x as i32, 0))
}

fn surface_size(surface: &str) -> Option<LogicalSize<f64>> {
    let (width, height) = match surface {
        "hidden" => (108.0, 12.0),
        "peek" => (96.0, 20.0),
        "petit" => (116.0, 38.0),
        "compact" => (196.0, 62.0),
        "expanded" => (414.0, 204.0),
        "modal" => (452.0, 278.0),
        _ => return None,
    };
    Some(LogicalSize::new(width, height))
}

fn resize_surface(window: &WebviewWindow, surface: &str) -> Result<(), String> {
    let size = surface_size(surface).ok_or("Unknown Lumi surface")?;
    window.set_size(size).map_err(|error| error.to_string())?;
    center_on_primary_monitor(window).map_err(|error| error.to_string())
}

fn configure_native_window(window: &WebviewWindow) -> tauri::Result<()> {
    window.set_always_on_top(true)?;
    window.set_skip_taskbar(true)?;
    window.set_visible_on_all_workspaces(true)?;
    // Mutter does not expose shaped client input regions to ordinary Wayland
    // clients. The backing window is therefore resized to the visible island,
    // while HIDDEN remains only a tiny, interactive top-edge hover sensor.
    window.set_size(LogicalSize::new(116.0, 38.0))?;
    center_on_primary_monitor(window)?;
    window.set_focusable(false)?;
    window.set_ignore_cursor_events(false)
}

#[tauri::command]
fn set_overlay_state(
    window: WebviewWindow,
    surface: String,
    interactive: bool,
    focusable: bool,
) -> Result<(), String> {
    // Keep this order atomic within one command: geometry first, then input
    // policy, then the explicit-focus request.
    resize_surface(&window, &surface)?;
    window.set_focusable(focusable).map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(!interactive)
        .map_err(|error| error.to_string())?;
    if focusable {
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn overlay_capabilities() -> OverlayCapabilities {
    let session = match std::env::var("XDG_SESSION_TYPE") {
        Ok(value) if value.eq_ignore_ascii_case("wayland") => "wayland",
        Ok(value) if value.eq_ignore_ascii_case("x11") => "x11",
        _ => "unknown",
    };

    OverlayCapabilities {
        session,
        placement: "native-window-fallback",
        supports_region_input: false,
    }
}

fn canonical_file(path: &str) -> Result<std::path::PathBuf, String> {
    let path = std::fs::canonicalize(path).map_err(|_| "The selected file is no longer available".to_string())?;
    if !path.is_file() {
        return Err("Nox Island only accepts files dropped by the user".into());
    }
    Ok(path)
}

#[tauri::command]
fn inspect_dropped_file(path: String) -> Result<DroppedFileInfo, String> {
    let path = canonical_file(&path)?;
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("Untitled file").to_string();
    let kind = path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| format!("{} file", extension.to_uppercase()))
        .unwrap_or_else(|| "File".into());
    Ok(DroppedFileInfo { path: path.to_string_lossy().into_owned(), name, kind, bytes: metadata.len() })
}

#[tauri::command]
async fn perform_file_action(
    state: State<'_, AssistantBridge>,
    path: String,
    action: String,
) -> Result<(), String> {
    let path = canonical_file(&path)?;
    match action.as_str() {
        "open_containing_folder" => {
            let parent = path.parent().ok_or("The selected file has no containing folder")?;
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|error| error.to_string())?;
            Ok(())
        }
        "attach" => codex_socket::attach_file(state.inner(), path.to_string_lossy().into_owned()).await,
        _ => Err("Unsupported file action".into()),
    }
}

#[tauri::command]
async fn request_quick_assistant(
    state: State<'_, AssistantBridge>,
    request_id: String,
    prompt: String,
    context: AssistantContext,
) -> Result<(), String> {
    if request_id.trim().is_empty() || request_id.len() > 128 {
        return Err("Invalid assistant request identifier".into());
    }
    if prompt.trim().is_empty() || prompt.chars().count() > 1000 {
        return Err("Assistant prompts must contain 1–1000 characters".into());
    }
    let file_path = context.file_path
        .as_deref()
        .map(canonical_file)
        .transpose()?
        .map(|path| path.to_string_lossy().into_owned());
    codex_socket::request_assistant(state.inner(), request_id, prompt, context.session_id, file_path).await
}

#[tauri::command]
fn resolve_codex_permission(
    state: State<'_, PendingPermissions>,
    request_id: String,
    decision: Decision,
) -> Result<(), String> {
    codex_socket::resolve(state.inner(), &request_id, decision)
}

#[tauri::command]
async fn media_command(
    state: State<'_, MprisState>,
    command: String,
) -> Result<(), String> {
    mpris::command(state.inner(), &command).await
}

pub fn run() {
    tauri::Builder::default()
        .manage(PendingPermissions::default())
        .manage(AssistantBridge::default())
        .manage(MprisState::default())
        .plugin(tauri_plugin_autostart::init(Default::default(), None::<Vec<String>>))
        .setup(|app| {
            let window = app
                .get_webview_window("nox-island")
                .expect("the configured Nox Island window should exist");
            configure_native_window(&window)?;

            let native_window = window.clone();
            window.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::ScaleFactorChanged { .. }) {
                    let _ = center_on_primary_monitor(&native_window);
                }
            });
            codex_socket::start(
                app.handle().clone(),
                app.state::<PendingPermissions>().inner().clone(),
                app.state::<AssistantBridge>().inner().clone(),
            );
            system_hud::start(app.handle().clone());
            mpris::start(app.handle().clone(), app.state::<MprisState>().inner().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_overlay_state,
            overlay_capabilities,
            resolve_codex_permission,
            media_command,
            inspect_dropped_file,
            perform_file_action,
            request_quick_assistant
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nox Island");
}

#[cfg(test)]
mod tests {
    use super::surface_size;

    #[test]
    fn surfaces_keep_logical_design_dimensions_at_fractional_scales() {
        let petit = surface_size("petit").expect("known surface");
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let physical = petit.to_physical::<u32>(scale);
            assert_eq!(physical.width, (116.0 * scale).round() as u32);
            assert_eq!(physical.height, (38.0 * scale).round() as u32);
        }
    }
}
