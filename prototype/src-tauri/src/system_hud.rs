use tauri::AppHandle;
use futures_util::StreamExt;
use zbus::Proxy;

use crate::events::{emit, RuntimeEvent};

pub fn start(app: AppHandle) {
    let initial_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = publish_battery(&initial_app).await;
        let _ = publish_network(&initial_app).await;
    });
    tauri::async_runtime::spawn(watch_battery(app.clone()));
    tauri::async_runtime::spawn(watch_network(app));
}

async fn publish_battery(app: &AppHandle) -> Result<(), String> {
    let connection = zbus::Connection::system().await.map_err(|error| error.to_string())?;
    let proxy = Proxy::new(&connection, "org.freedesktop.UPower", "/org/freedesktop/UPower/devices/DisplayDevice", "org.freedesktop.UPower.Device").await.map_err(|error| error.to_string())?;
    let percentage: f64 = proxy.get_property("Percentage").await.map_err(|error| error.to_string())?;
    let state: u32 = proxy.get_property("State").await.map_err(|error| error.to_string())?;
    emit(app, RuntimeEvent::Battery { percentage, charging: state == 1, critical: percentage <= 15.0 });
    Ok(())
}

async fn publish_network(app: &AppHandle) -> Result<(), String> {
    let connection = zbus::Connection::system().await.map_err(|error| error.to_string())?;
    let proxy = Proxy::new(&connection, "org.freedesktop.NetworkManager", "/org/freedesktop/NetworkManager", "org.freedesktop.NetworkManager").await.map_err(|error| error.to_string())?;
    let connectivity: u32 = proxy.get_property("Connectivity").await.map_err(|error| error.to_string())?;
    emit(app, RuntimeEvent::Network { connected: connectivity == 4, ssid: None });
    Ok(())
}

async fn watch_battery(app: AppHandle) {
    let Ok(connection) = zbus::Connection::system().await else { return; };
    let Ok(proxy) = Proxy::new(&connection, "org.freedesktop.UPower", "/org/freedesktop/UPower/devices/DisplayDevice", "org.freedesktop.UPower.Device").await else { return; };
    let Ok(mut changes) = proxy.receive_property_changed::<f64>("Percentage").await else { return; };
    while let Some(change) = changes.next().await {
        let Ok(percentage) = change.get().await else { continue; };
        let charging = proxy.get_property::<u32>("State").await.map(|state| state == 1).unwrap_or(false);
        emit(&app, RuntimeEvent::Battery { percentage, charging, critical: percentage <= 15.0 });
    }
}

async fn watch_network(app: AppHandle) {
    let Ok(connection) = zbus::Connection::system().await else { return; };
    let Ok(proxy) = Proxy::new(&connection, "org.freedesktop.NetworkManager", "/org/freedesktop/NetworkManager", "org.freedesktop.NetworkManager").await else { return; };
    let Ok(mut changes) = proxy.receive_property_changed::<u32>("Connectivity").await else { return; };
    while let Some(change) = changes.next().await {
        let Ok(connectivity) = change.get().await else { continue; };
        emit(&app, RuntimeEvent::Network { connected: connectivity == 4, ssid: None });
    }
}
