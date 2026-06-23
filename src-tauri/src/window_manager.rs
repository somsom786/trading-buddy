use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Manager, PhysicalPosition, Runtime,
};

const BUDDY_LABEL: &str = "buddy";
const MAIN_LABEL: &str = "main";
const POSITION_FILE: &str = "buddy-window.json";

#[derive(Debug, Deserialize, Serialize)]
struct SavedWindowPosition {
    x: i32,
    y: i32,
}

pub fn open_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<(), String> {
    if !matches!(label, BUDDY_LABEL | MAIN_LABEL) {
        return Err(format!("unknown window label: {label}"));
    }

    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window not found: {label}"))?;

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub fn control_window<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    action: &str,
) -> Result<(), String> {
    if !matches!(label, BUDDY_LABEL | MAIN_LABEL) {
        return Err(format!("unknown window label: {label}"));
    }
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window not found: {label}"))?;
    match action {
        "show" => window.show(),
        "hide" => window.hide(),
        "focus" => {
            window.show().map_err(|error| error.to_string())?;
            window.unminimize().map_err(|error| error.to_string())?;
            window.set_focus()
        }
        _ => return Err(format!("unknown window action: {action}")),
    }
    .map_err(|error| error.to_string())
}

pub fn restore_buddy_position<R: Runtime>(app: &AppHandle<R>) {
    let Some(position) = load_position(app) else {
        return;
    };
    let Some(window) = app.get_webview_window(BUDDY_LABEL) else {
        return;
    };

    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
}

pub fn persist_buddy_position<R: Runtime>(app: &AppHandle<R>, position: PhysicalPosition<i32>) {
    let saved_position = SavedWindowPosition {
        x: position.x,
        y: position.y,
    };
    let Ok(serialized) = serde_json::to_vec_pretty(&saved_position) else {
        return;
    };
    let Some(path) = position_file_path(app) else {
        return;
    };
    let Some(parent) = path.parent() else {
        return;
    };

    if fs::create_dir_all(parent).is_ok() {
        let _ = fs::write(path, serialized);
    }
}

pub fn create_tray(app: &App) -> tauri::Result<()> {
    let open_buddy = MenuItem::with_id(app, "open_buddy", "Open Buddy", true, None::<&str>)?;
    let open_main = MenuItem::with_id(app, "open_main", "Open Main Window", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_buddy, &open_main, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("Trading Buddy — BETA v0.1")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_buddy" => {
                let _ = open_window(app, BUDDY_LABEL);
            }
            "open_main" => {
                let _ = open_window(app, MAIN_LABEL);
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

fn load_position<R: Runtime>(app: &AppHandle<R>) -> Option<SavedWindowPosition> {
    let contents = fs::read(position_file_path(app)?).ok()?;
    serde_json::from_slice(&contents).ok()
}

fn position_file_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join(POSITION_FILE))
}

#[cfg(test)]
mod tests {
    use super::SavedWindowPosition;

    #[test]
    fn saved_position_round_trips_through_json() {
        let position = SavedWindowPosition { x: -120, y: 48 };
        let serialized = serde_json::to_string(&position).expect("position should serialize");
        let restored: SavedWindowPosition =
            serde_json::from_str(&serialized).expect("position should deserialize");

        assert_eq!(restored.x, -120);
        assert_eq!(restored.y, 48);
    }
}
