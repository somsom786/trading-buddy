use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Emitter, Manager, PhysicalPosition, Runtime,
};

const BUDDY_LABEL: &str = "buddy";
const BUBBLE_LABEL: &str = "bubble";
const MAIN_LABEL: &str = "main";
const POSITION_FILE: &str = "buddy-window.json";
const COMPANION_COMMAND_EVENT: &str = "trading-buddy://companion-command";
const BUBBLE_GAP: i32 = 10;
const SCREEN_MARGIN: i32 = 14;

#[derive(Debug, Deserialize, Serialize)]
struct SavedWindowPosition {
    x: i32,
    y: i32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case", tag = "type")]
enum NativeCompanionCommand {
    ToggleBubble,
    SetState { state: &'static str },
    DoNotDisturb,
}

pub fn open_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<(), String> {
    validate_label(label)?;
    if label == BUBBLE_LABEL {
        position_bubble(app)?;
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
    validate_label(label)?;
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window not found: {label}"))?;
    match action {
        "show" => {
            if label == BUBBLE_LABEL {
                position_bubble(app)?;
            }
            window.show()
        }
        "hide" => window.hide(),
        "focus" => {
            if label == BUBBLE_LABEL {
                position_bubble(app)?;
            }
            window.show().map_err(|error| error.to_string())?;
            window.unminimize().map_err(|error| error.to_string())?;
            window.set_focus()
        }
        _ => return Err(format!("unknown window action: {action}")),
    }
    .map_err(|error| error.to_string())
}

pub fn toggle_bubble<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let bubble = app
        .get_webview_window(BUBBLE_LABEL)
        .ok_or_else(|| "bubble window not found".to_owned())?;
    if bubble.is_visible().map_err(|error| error.to_string())? {
        bubble.hide().map_err(|error| error.to_string())
    } else {
        position_bubble(app)?;
        bubble.show().map_err(|error| error.to_string())?;
        bubble.set_focus().map_err(|error| error.to_string())
    }
}

pub fn position_bubble<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let buddy = app
        .get_webview_window(BUDDY_LABEL)
        .ok_or_else(|| "buddy window not found".to_owned())?;
    let bubble = app
        .get_webview_window(BUBBLE_LABEL)
        .ok_or_else(|| "bubble window not found".to_owned())?;

    let buddy_position = buddy.outer_position().map_err(|error| error.to_string())?;
    let buddy_size = buddy.outer_size().map_err(|error| error.to_string())?;
    let bubble_size = bubble.outer_size().map_err(|error| error.to_string())?;
    let work_area = monitor_bounds(app, &buddy)?;

    let buddy_right = buddy_position.x + buddy_size.width as i32;
    let right_x = buddy_right + BUBBLE_GAP;
    let left_x = buddy_position.x - bubble_size.width as i32 - BUBBLE_GAP;
    let work_right = work_area.x + work_area.width;
    let space_right = work_right - right_x;
    let space_left = left_x - work_area.x;

    let preferred_x = if space_right >= bubble_size.width as i32 || space_right >= space_left {
        right_x
    } else {
        left_x
    };
    let x = clamp_i32(
        preferred_x,
        work_area.x + SCREEN_MARGIN,
        work_right - bubble_size.width as i32 - SCREEN_MARGIN,
    );
    let centered_y =
        buddy_position.y + (buddy_size.height as i32 / 2) - (bubble_size.height as i32 / 2);
    let y = clamp_i32(
        centered_y,
        work_area.y + SCREEN_MARGIN,
        work_area.y + work_area.height - bubble_size.height as i32 - SCREEN_MARGIN,
    );

    bubble
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

pub fn reset_buddy_position<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let buddy = app
        .get_webview_window(BUDDY_LABEL)
        .ok_or_else(|| "buddy window not found".to_owned())?;
    let buddy_size = buddy.outer_size().map_err(|error| error.to_string())?;
    let work_area = monitor_bounds(app, &buddy)?;
    let x = work_area.x + work_area.width - buddy_size.width as i32 - 48;
    let y = work_area.y + work_area.height - buddy_size.height as i32 - 80;
    let position = PhysicalPosition::new(x, y);
    buddy
        .set_position(position)
        .map_err(|error| error.to_string())?;
    persist_buddy_position(app, position);
    position_bubble(app)
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

pub fn apply_startup_preferences<R: Runtime>(
    app: &AppHandle<R>,
    preferences: &crate::storage::models::CompanionPreferences,
) {
    if let Some(buddy) = app.get_webview_window(BUDDY_LABEL) {
        let _ = buddy.set_always_on_top(preferences.buddy_always_on_top);
        if preferences.buddy_visible {
            let _ = buddy.show();
        } else {
            let _ = buddy.hide();
        }
    }
    if preferences.open_companion_home_at_startup {
        let _ = open_window(app, MAIN_LABEL);
    }
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
    let talk = MenuItem::with_id(app, "talk", "Talk", true, None::<&str>)?;
    let open_main = MenuItem::with_id(app, "open_main", "Open Companion Home", true, None::<&str>)?;
    let show_buddy = MenuItem::with_id(app, "show_buddy", "Show Buddy", true, None::<&str>)?;
    let hide_buddy = MenuItem::with_id(app, "hide_buddy", "Hide Buddy", true, None::<&str>)?;
    let sleep = MenuItem::with_id(app, "sleep", "Sleep", true, None::<&str>)?;
    let wake = MenuItem::with_id(app, "wake", "Wake", true, None::<&str>)?;
    let do_not_disturb =
        MenuItem::with_id(app, "do_not_disturb", "Do Not Disturb", true, None::<&str>)?;
    let reset_position =
        MenuItem::with_id(app, "reset_position", "Reset Position", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &talk,
            &open_main,
            &show_buddy,
            &hide_buddy,
            &sleep,
            &wake,
            &do_not_disturb,
            &reset_position,
            &quit,
        ],
    )?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("Trading Buddy — BETA v0.1")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "talk" => {
                let _ = toggle_bubble(app);
                let _ = app.emit_to(
                    BUDDY_LABEL,
                    COMPANION_COMMAND_EVENT,
                    NativeCompanionCommand::ToggleBubble,
                );
            }
            "open_main" => {
                let _ = open_window(app, MAIN_LABEL);
            }
            "show_buddy" => {
                let _ = control_window(app, BUDDY_LABEL, "show");
            }
            "hide_buddy" => {
                let _ = control_window(app, BUDDY_LABEL, "hide");
            }
            "sleep" => {
                let _ = app.emit_to(
                    BUDDY_LABEL,
                    COMPANION_COMMAND_EVENT,
                    NativeCompanionCommand::SetState { state: "sleeping" },
                );
            }
            "wake" => {
                let _ = app.emit_to(
                    BUDDY_LABEL,
                    COMPANION_COMMAND_EVENT,
                    NativeCompanionCommand::SetState { state: "idle" },
                );
            }
            "do_not_disturb" => {
                let _ = app.emit_to(
                    BUDDY_LABEL,
                    COMPANION_COMMAND_EVENT,
                    NativeCompanionCommand::DoNotDisturb,
                );
                let _ = app.emit_to(
                    BUBBLE_LABEL,
                    COMPANION_COMMAND_EVENT,
                    NativeCompanionCommand::DoNotDisturb,
                );
            }
            "reset_position" => {
                let _ = reset_buddy_position(app);
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

fn validate_label(label: &str) -> Result<(), String> {
    if matches!(label, BUDDY_LABEL | BUBBLE_LABEL | MAIN_LABEL) {
        Ok(())
    } else {
        Err(format!("unknown window label: {label}"))
    }
}

#[derive(Clone, Copy)]
struct NativeRect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

fn monitor_bounds<R: Runtime>(
    app: &AppHandle<R>,
    buddy: &tauri::WebviewWindow<R>,
) -> Result<NativeRect, String> {
    let monitor = buddy
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or(app.primary_monitor().map_err(|error| error.to_string())?);
    let Some(monitor) = monitor else {
        return Ok(NativeRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
    };
    let position = monitor.position();
    let size = monitor.size();
    Ok(NativeRect {
        x: position.x,
        y: position.y,
        width: size.width as i32,
        height: size.height as i32,
    })
}

fn clamp_i32(value: i32, min: i32, max: i32) -> i32 {
    if min > max {
        min
    } else {
        value.clamp(min, max)
    }
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
    use super::{clamp_i32, SavedWindowPosition};

    #[test]
    fn saved_position_round_trips_through_json() {
        let position = SavedWindowPosition { x: -120, y: 48 };
        let serialized = serde_json::to_string(&position).expect("position should serialize");
        let restored: SavedWindowPosition =
            serde_json::from_str(&serialized).expect("position should deserialize");

        assert_eq!(restored.x, -120);
        assert_eq!(restored.y, 48);
    }

    #[test]
    fn clamp_handles_tiny_work_areas() {
        assert_eq!(clamp_i32(500, 20, 10), 20);
        assert_eq!(clamp_i32(5, 10, 20), 10);
        assert_eq!(clamp_i32(30, 10, 20), 20);
    }
}
