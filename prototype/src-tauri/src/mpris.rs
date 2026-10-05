use std::sync::{Arc, Mutex};

use tauri::AppHandle;
use std::collections::HashMap;

use futures_util::StreamExt;
use zbus::{zvariant::OwnedValue, Proxy};

use crate::events::{emit, Playback, RuntimeEvent};

const OBJECT_PATH: &str = "/org/mpris/MediaPlayer2";
const PLAYER_INTERFACE: &str = "org.mpris.MediaPlayer2.Player";

#[derive(Clone, Default)]
pub struct MprisState(pub Arc<Mutex<Option<String>>>);

pub fn start(app: AppHandle, state: MprisState) {
    tauri::async_runtime::spawn(async move {
        let _ = publish_active_player(&app, &state).await;
        watch_active_player(app, state).await;
    });
}

pub async fn command(state: &MprisState, command: &str) -> Result<(), String> {
    let player = state.0.lock().map_err(|_| "MPRIS state is unavailable")?.clone().ok_or("No MPRIS player is active")?;
    let connection = zbus::Connection::session().await.map_err(|error| error.to_string())?;
    let proxy = Proxy::new(&connection, player, OBJECT_PATH, PLAYER_INTERFACE).await.map_err(|error| error.to_string())?;
    let method = match command {
        "previous" => "Previous",
        "play_pause" => "PlayPause",
        "next" => "Next",
        _ => return Err("unsupported media command".into()),
    };
    proxy.call_noreply(method, &()).await.map_err(|error| error.to_string())
}

async fn publish_active_player(app: &AppHandle, state: &MprisState) -> Result<(), String> {
    let connection = zbus::Connection::session().await.map_err(|error| error.to_string())?;
    let bus = Proxy::new(&connection, "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus").await.map_err(|error| error.to_string())?;
    let names: Vec<String> = bus.call("ListNames", &()).await.map_err(|error| error.to_string())?;
    let Some(player) = names.into_iter().find(|name| name.starts_with("org.mpris.MediaPlayer2.")) else { return Ok(()); };
    let proxy = Proxy::new(&connection, &player, OBJECT_PATH, PLAYER_INTERFACE).await.map_err(|error| error.to_string())?;
    let playback_status: String = proxy.get_property("PlaybackStatus").await.map_err(|error| error.to_string())?;
    let playback = match playback_status.as_str() {
        "Playing" => Playback::Playing,
        "Paused" => Playback::Paused,
        _ => Playback::Stopped,
    };
    let display_name = player.trim_start_matches("org.mpris.MediaPlayer2.").replace('_', " ");
    if let Ok(mut active) = state.0.lock() { *active = Some(player); }
    let metadata: HashMap<String, OwnedValue> = proxy.get_property("Metadata").await.unwrap_or_default();
    let title = metadata.get("xesam:title").and_then(|value| String::try_from(value.clone()).ok()).unwrap_or_else(|| "Current track".into());
    let artist = metadata.get("xesam:artist")
        .and_then(|value| Vec::<String>::try_from(value.clone()).ok())
        .filter(|artists| !artists.is_empty())
        .map(|artists| artists.join(", "));
    let art_url = metadata.get("mpris:artUrl").and_then(|value| String::try_from(value.clone()).ok());
    emit(app, RuntimeEvent::Media { player: display_name, title, artist, art_url, playback });
    Ok(())
}

async fn watch_active_player(app: AppHandle, state: MprisState) {
    let Some(player) = state.0.lock().ok().and_then(|active| active.clone()) else { return; };
    let Ok(connection) = zbus::Connection::session().await else { return; };
    let Ok(proxy) = Proxy::new(&connection, &player, OBJECT_PATH, PLAYER_INTERFACE).await else { return; };
    let Ok(mut changes) = proxy.receive_property_changed::<String>("PlaybackStatus").await else { return; };
    while let Some(change) = changes.next().await {
        if change.get().await.is_ok() {
            let _ = publish_active_player(&app, &state).await;
        }
    }
}
