use tauri::{
  AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
  menu::{Menu, MenuItem, PredefinedMenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct AppState {
  always_on_top: Arc<Mutex<bool>>,
}

#[tauri::command]
fn toggle_always_on_top(window: WebviewWindow, state: State<AppState>) -> Result<bool, String> {
  let mut always_on_top = state.always_on_top.lock().unwrap();
  *always_on_top = !*always_on_top;
  window.set_always_on_top(*always_on_top).map_err(|e| e.to_string())?;
  Ok(*always_on_top)
}

#[tauri::command]
fn show_window(window: WebviewWindow) -> Result<(), String> {
  window.show().map_err(|e| e.to_string())?;
  window.set_focus().map_err(|e| e.to_string())?;
  Ok(())
}

fn create_tray_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
  let toggle_item = MenuItem::with_id(app, "always_on_top", "Always on Top", true, Some("always-on-top"))?;
  let show_item = MenuItem::with_id(app, "show", "Show MIDI Controller", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, "quit", "Quit", true, Some("q"))?;

  let menu = Menu::with_items(app, &[
    &show_item,
    &toggle_item,
    &PredefinedMenuItem::separator(app)?,
    &quit_item,
  ])?;

  Ok(menu)
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let menu = create_tray_menu(app)?;

  let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .on_menu_event(|app, event| {
      match event.id().as_ref() {
        "show" => {
          if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
        "always_on_top" => {
          if let Some(window) = app.get_webview_window("main") {
            let state: State<AppState> = app.state();
            let mut always_on_top = state.always_on_top.lock().unwrap();
            *always_on_top = !*always_on_top;
            let _ = window.set_always_on_top(*always_on_top);
          }
        }
        "quit" => {
          app.exit(0);
        }
        _ => {}
      }
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    })
    .build(app)?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize app state
      let state = AppState {
        always_on_top: Arc::new(Mutex::new(true)),
      };
      app.manage(state);

      // Create main window (it starts hidden as per config)
      let window = app.get_webview_window("main").unwrap();

      // Set up window event listeners
      let window_clone = window.clone();
      window.on_window_event(move |event| {
        match event {
          tauri::WindowEvent::Focused(focused) => {
            if *focused {
              let _ = window_clone.emit("app-focus", ());
            } else {
              let _ = window_clone.emit("app-blur", ());
            }
          }
          _ => {}
        }
      });

      // Show window once ready
      window.show()?;

      // Setup system tray
      setup_tray(&app.handle())?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![toggle_always_on_top, show_window])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
