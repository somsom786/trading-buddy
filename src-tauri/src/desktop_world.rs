use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

const MAX_VISIBLE_WINDOW_RECTS: usize = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorSurface {
    pub id: String,
    pub bounds: SurfaceRect,
    pub scale_factor: f64,
    pub primary: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkArea {
    pub monitor_id: String,
    pub bounds: SurfaceRect,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWorldSnapshot {
    pub monitors: Vec<MonitorSurface>,
    pub work_areas: Vec<WorkArea>,
    pub visible_window_rects: Vec<SurfaceRect>,
    pub buddy_rect: SurfaceRect,
    pub bubble_rect: Option<SurfaceRect>,
    pub cursor_position: Option<Point>,
    pub captured_at_ms: u64,
    pub surface_support: SurfaceSupport,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SurfaceSupport {
    WindowsGeometry,
    MonitorOnlyFallback,
}

trait DesktopWorldAdapter {
    fn platform_geometry(&self, include_cursor: bool) -> PlatformGeometry;
}

#[derive(Default)]
struct PlatformGeometry {
    monitor_work_areas: Vec<(SurfaceRect, SurfaceRect)>,
    visible_window_rects: Vec<SurfaceRect>,
    cursor_position: Option<Point>,
    surface_support: Option<SurfaceSupport>,
}

pub fn snapshot<R: Runtime>(
    app: &AppHandle<R>,
    include_cursor: bool,
) -> Result<DesktopWorldSnapshot, String> {
    let buddy = app
        .get_webview_window("buddy")
        .ok_or_else(|| "buddy window not found".to_owned())?;
    let buddy_rect = webview_rect(&buddy)?;
    let bubble_rect =
        app.get_webview_window("bubble")
            .and_then(|window| match window.is_visible() {
                Ok(true) => webview_rect(&window).ok(),
                _ => None,
            });

    let adapter = platform_adapter();
    let platform = adapter.platform_geometry(include_cursor);
    let tauri_monitors = app
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let primary_monitor = app.primary_monitor().map_err(|error| error.to_string())?;
    let primary_bounds = primary_monitor.as_ref().map(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        SurfaceRect::new(
            position.x,
            position.y,
            size.width as i32,
            size.height as i32,
        )
    });

    let mut monitor_pairs = if platform.monitor_work_areas.is_empty() {
        tauri_monitors
            .iter()
            .map(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                let bounds = SurfaceRect::new(
                    position.x,
                    position.y,
                    size.width as i32,
                    size.height as i32,
                );
                (bounds, bounds)
            })
            .collect::<Vec<_>>()
    } else {
        platform.monitor_work_areas
    };
    monitor_pairs.sort_by_key(|(bounds, _)| (bounds.x, bounds.y, bounds.width, bounds.height));

    let mut monitors = Vec::with_capacity(monitor_pairs.len());
    let mut work_areas = Vec::with_capacity(monitor_pairs.len());
    for (index, (bounds, work_area)) in monitor_pairs.into_iter().enumerate() {
        let id = format!("monitor-{index}");
        let scale_factor = tauri_monitors
            .iter()
            .find(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                position.x == bounds.x
                    && position.y == bounds.y
                    && size.width as i32 == bounds.width
                    && size.height as i32 == bounds.height
            })
            .map_or(1.0, |monitor| monitor.scale_factor());
        monitors.push(MonitorSurface {
            id: id.clone(),
            bounds,
            scale_factor,
            primary: primary_bounds == Some(bounds),
        });
        work_areas.push(WorkArea {
            monitor_id: id,
            bounds: work_area,
        });
    }

    let monitor_bounds = monitors
        .iter()
        .map(|monitor| monitor.bounds)
        .collect::<Vec<_>>();
    let visible_window_rects = sanitize_visible_window_rects(
        platform.visible_window_rects,
        &monitor_bounds,
        buddy_rect,
        bubble_rect,
    );

    Ok(DesktopWorldSnapshot {
        monitors,
        work_areas,
        visible_window_rects,
        buddy_rect,
        bubble_rect,
        cursor_position: include_cursor.then_some(platform.cursor_position).flatten(),
        captured_at_ms: now_ms(),
        surface_support: platform
            .surface_support
            .unwrap_or(SurfaceSupport::MonitorOnlyFallback),
    })
}

fn webview_rect<R: Runtime>(window: &tauri::WebviewWindow<R>) -> Result<SurfaceRect, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(SurfaceRect::new(
        position.x,
        position.y,
        size.width as i32,
        size.height as i32,
    ))
}

fn sanitize_visible_window_rects(
    rectangles: Vec<SurfaceRect>,
    monitor_bounds: &[SurfaceRect],
    buddy_rect: SurfaceRect,
    bubble_rect: Option<SurfaceRect>,
) -> Vec<SurfaceRect> {
    let mut result = rectangles
        .into_iter()
        .filter(|rect| rect.is_valid())
        .filter(|rect| {
            monitor_bounds
                .iter()
                .any(|monitor| rect.intersects(*monitor))
        })
        .filter(|rect| !rect.approximately_equals(buddy_rect))
        .filter(|rect| {
            bubble_rect
                .map(|bubble| !rect.approximately_equals(bubble))
                .unwrap_or(true)
        })
        .collect::<Vec<_>>();
    result.sort_by_key(|rect| (rect.y, rect.x, rect.width, rect.height));
    result.dedup();
    result.truncate(MAX_VISIBLE_WINDOW_RECTS);
    result
}

impl SurfaceRect {
    fn new(x: i32, y: i32, width: i32, height: i32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    fn is_valid(self) -> bool {
        self.width > 1 && self.height > 1
    }

    fn right(self) -> i64 {
        i64::from(self.x) + i64::from(self.width)
    }

    fn bottom(self) -> i64 {
        i64::from(self.y) + i64::from(self.height)
    }

    fn intersects(self, other: Self) -> bool {
        i64::from(self.x) < other.right()
            && self.right() > i64::from(other.x)
            && i64::from(self.y) < other.bottom()
            && self.bottom() > i64::from(other.y)
    }

    fn approximately_equals(self, other: Self) -> bool {
        (i64::from(self.x) - i64::from(other.x)).abs() <= 2
            && (i64::from(self.y) - i64::from(other.y)).abs() <= 2
            && (i64::from(self.width) - i64::from(other.width)).abs() <= 2
            && (i64::from(self.height) - i64::from(other.height)).abs() <= 2
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

#[cfg(target_os = "windows")]
fn platform_adapter() -> Box<dyn DesktopWorldAdapter> {
    Box::new(WindowsDesktopWorldAdapter)
}

#[cfg(not(target_os = "windows"))]
fn platform_adapter() -> Box<dyn DesktopWorldAdapter> {
    Box::new(MonitorOnlyDesktopWorldAdapter)
}

#[cfg(not(target_os = "windows"))]
struct MonitorOnlyDesktopWorldAdapter;

#[cfg(not(target_os = "windows"))]
impl DesktopWorldAdapter for MonitorOnlyDesktopWorldAdapter {
    fn platform_geometry(&self, _include_cursor: bool) -> PlatformGeometry {
        PlatformGeometry {
            surface_support: Some(SurfaceSupport::MonitorOnlyFallback),
            ..PlatformGeometry::default()
        }
    }
}

#[cfg(target_os = "windows")]
struct WindowsDesktopWorldAdapter;

#[cfg(target_os = "windows")]
impl DesktopWorldAdapter for WindowsDesktopWorldAdapter {
    fn platform_geometry(&self, include_cursor: bool) -> PlatformGeometry {
        use windows_sys::Win32::{Foundation::POINT, UI::WindowsAndMessaging::GetCursorPos};

        let cursor_position = if include_cursor {
            let mut point = POINT { x: 0, y: 0 };
            let succeeded = unsafe { GetCursorPos(&mut point) } != 0;
            succeeded.then_some(Point {
                x: point.x,
                y: point.y,
            })
        } else {
            None
        };

        PlatformGeometry {
            monitor_work_areas: windows_monitor_work_areas(),
            visible_window_rects: windows_visible_window_rects(),
            cursor_position,
            surface_support: Some(SurfaceSupport::WindowsGeometry),
        }
    }
}

#[cfg(target_os = "windows")]
fn windows_monitor_work_areas() -> Vec<(SurfaceRect, SurfaceRect)> {
    use windows_sys::Win32::{
        Foundation::{BOOL, LPARAM, RECT},
        Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO},
    };

    unsafe extern "system" fn callback(
        monitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        data: LPARAM,
    ) -> BOOL {
        let output = &mut *(data as *mut Vec<(SurfaceRect, SurfaceRect)>);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: empty_windows_rect(),
            rcWork: empty_windows_rect(),
            dwFlags: 0,
        };
        if GetMonitorInfoW(monitor, &mut info) != 0 {
            output.push((
                rect_from_windows(info.rcMonitor),
                rect_from_windows(info.rcWork),
            ));
        }
        1
    }

    let mut output = Vec::new();
    unsafe {
        EnumDisplayMonitors(
            std::ptr::null_mut(),
            std::ptr::null(),
            Some(callback),
            (&mut output as *mut Vec<(SurfaceRect, SurfaceRect)>) as LPARAM,
        );
    }
    output
}

#[cfg(target_os = "windows")]
fn windows_visible_window_rects() -> Vec<SurfaceRect> {
    use windows_sys::Win32::{
        Foundation::{BOOL, HWND, LPARAM},
        UI::WindowsAndMessaging::{EnumWindows, GetWindowRect, IsIconic, IsWindowVisible},
    };

    unsafe extern "system" fn callback(window: HWND, data: LPARAM) -> BOOL {
        if IsWindowVisible(window) == 0 || IsIconic(window) != 0 {
            return 1;
        }
        let mut rect = empty_windows_rect();
        if GetWindowRect(window, &mut rect) != 0 {
            let output = &mut *(data as *mut Vec<SurfaceRect>);
            output.push(rect_from_windows(rect));
        }
        1
    }

    let mut output = Vec::new();
    unsafe {
        EnumWindows(
            Some(callback),
            (&mut output as *mut Vec<SurfaceRect>) as LPARAM,
        );
    }
    output
}

#[cfg(target_os = "windows")]
fn rect_from_windows(rect: windows_sys::Win32::Foundation::RECT) -> SurfaceRect {
    SurfaceRect::new(
        rect.left,
        rect.top,
        rect.right.saturating_sub(rect.left),
        rect.bottom.saturating_sub(rect.top),
    )
}

#[cfg(target_os = "windows")]
fn empty_windows_rect() -> windows_sys::Win32::Foundation::RECT {
    windows_sys::Win32::Foundation::RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        sanitize_visible_window_rects, DesktopWorldSnapshot, MonitorSurface, Point, SurfaceRect,
        SurfaceSupport, WorkArea,
    };

    #[test]
    fn sanitizes_invalid_offscreen_buddy_bubble_and_duplicate_rectangles() {
        let monitor = SurfaceRect::new(-1920, 0, 3840, 1080);
        let buddy = SurfaceRect::new(100, 100, 140, 140);
        let bubble = SurfaceRect::new(250, 90, 360, 270);
        let valid = SurfaceRect::new(-1200, 50, 800, 600);
        let result = sanitize_visible_window_rects(
            vec![
                valid,
                valid,
                buddy,
                SurfaceRect::new(101, 99, 140, 141),
                bubble,
                SurfaceRect::new(5000, 5000, 100, 100),
                SurfaceRect::new(0, 0, 0, 100),
            ],
            &[monitor],
            buddy,
            Some(bubble),
        );

        assert_eq!(result, vec![valid]);
    }

    #[test]
    fn keeps_rectangles_that_partially_intersect_negative_coordinate_monitors() {
        let result = sanitize_visible_window_rects(
            vec![SurfaceRect::new(-2000, 100, 200, 300)],
            &[SurfaceRect::new(-1920, 0, 1920, 1080)],
            SurfaceRect::new(100, 100, 140, 140),
            None,
        );

        assert_eq!(result.len(), 1);
    }

    #[test]
    fn serialized_snapshot_contains_geometry_only_contract() {
        let snapshot = DesktopWorldSnapshot {
            monitors: vec![MonitorSurface {
                id: "monitor-0".to_owned(),
                bounds: SurfaceRect::new(0, 0, 1920, 1080),
                scale_factor: 1.25,
                primary: true,
            }],
            work_areas: vec![WorkArea {
                monitor_id: "monitor-0".to_owned(),
                bounds: SurfaceRect::new(0, 0, 1920, 1040),
            }],
            visible_window_rects: vec![SurfaceRect::new(20, 20, 800, 600)],
            buddy_rect: SurfaceRect::new(100, 100, 140, 140),
            bubble_rect: None,
            cursor_position: Some(Point { x: 40, y: 50 }),
            captured_at_ms: 1,
            surface_support: SurfaceSupport::WindowsGeometry,
        };
        let json = serde_json::to_string(&snapshot).expect("snapshot should serialize");

        for prohibited in [
            "title",
            "process",
            "applicationName",
            "browserUrl",
            "pixels",
            "screenshot",
            "clipboard",
            "keystroke",
            "content",
        ] {
            assert!(
                !json.contains(prohibited),
                "found prohibited key {prohibited}"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_geometry_probe_returns_real_monitor_and_work_area_bounds() {
        let monitor_work_areas = super::windows_monitor_work_areas();

        assert!(!monitor_work_areas.is_empty());
        assert!(monitor_work_areas
            .iter()
            .all(|(monitor, work_area)| monitor.is_valid() && work_area.is_valid()));
        let monitor_bounds = monitor_work_areas
            .iter()
            .map(|(monitor, _)| *monitor)
            .collect::<Vec<_>>();
        let sanitized = sanitize_visible_window_rects(
            super::windows_visible_window_rects(),
            &monitor_bounds,
            SurfaceRect::new(i32::MAX - 200, i32::MAX - 200, 100, 100),
            None,
        );
        assert!(sanitized.into_iter().all(SurfaceRect::is_valid));
    }
}
