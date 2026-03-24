// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager, State, WebviewWindow};
use tokio::sync::{mpsc, Mutex};

mod checkpoint;
mod commands;
mod config;
mod downloader;
mod obs_client;
mod scheduler;

use checkpoint::{CheckpointData, CheckpointManager};
use config::DownloadConfig;
use downloader::{DownloadManager, DownloadProgress};

// 应用状态
struct AppState {
    checkpoint_manager: Arc<CheckpointManager>,
    download_manager: Arc<Mutex<Option<DownloadManager>>>,
}

#[derive(serde::Serialize)]
struct IpcResponse<T: serde::Serialize> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T: serde::Serialize> IpcResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(msg: impl ToString) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        }
    }
}

// 加载配置文件
#[tauri::command]
async fn load_config(path: String) -> Result<IpcResponse<DownloadConfig>, String> {
    match DownloadConfig::from_file(&path) {
        Ok(config) => {
            // 验证配置是否过期
            if config.is_expired() {
                return Ok(IpcResponse::error("配置文件已过期，请重新导出"));
            }
            Ok(IpcResponse::success(config))
        }
        Err(e) => Ok(IpcResponse::error(format!("加载配置失败: {}", e))),
    }
}

// 加载检查点
#[tauri::command]
async fn load_checkpoint(
    state: State<'_, AppState>,
) -> Result<IpcResponse<Option<CheckpointData>>, String> {
    let manager = &state.checkpoint_manager;

    // 获取最新的检查点
    match manager.list_all() {
        Ok(checkpoints) => {
            // 找到最新的未完成任务
            let latest = checkpoints
                .into_iter()
                .filter(|c| c.completed_tasks.len() < c.config.tasks.len())
                .max_by_key(|c| c.timestamp);
            Ok(IpcResponse::success(latest))
        }
        Err(e) => Ok(IpcResponse::error(format!("加载检查点失败: {}", e))),
    }
}

// 清除检查点
#[tauri::command]
async fn clear_checkpoint(
    state: State<'_, AppState>,
    export_id: String,
) -> Result<IpcResponse<()>, String> {
    let manager = &state.checkpoint_manager;

    match manager.delete(&export_id) {
        Ok(_) => Ok(IpcResponse::success(())),
        Err(e) => Ok(IpcResponse::error(format!("清除检查点失败: {}", e))),
    }
}

// 开始下载
#[tauri::command]
async fn start_download(
    window: WebviewWindow,
    state: State<'_, AppState>,
    config: DownloadConfig,
    download_dir: String,
) -> Result<IpcResponse<()>, String> {
    tracing::info!("Starting download to dir: {}", download_dir);

    // 创建下载目录
    let download_path = PathBuf::from(&download_dir);
    if let Err(e) = tokio::fs::create_dir_all(&download_path).await {
        return Ok(IpcResponse::error(format!("创建下载目录失败: {}", e)));
    }

    // 获取检查点管理器
    let checkpoint_manager = Arc::clone(&state.checkpoint_manager);

    // 创建下载管理器
    let mut download_manager = match DownloadManager::new(config, download_path, checkpoint_manager)
    {
        Ok(manager) => manager,
        Err(e) => {
            tracing::error!("Failed to create download manager: {}", e);
            return Ok(IpcResponse::error(format!("创建下载管理器失败: {}", e)));
        }
    };

    // 创建进度通道
    let (progress_tx, mut progress_rx) = mpsc::channel::<DownloadProgress>(100);
    download_manager.set_progress_sender(progress_tx);

    // 先启动进度转发任务
    let window_clone = window.clone();
    let progress_handle = tauri::async_runtime::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            let _ = window_clone.emit("download:progress", &progress);
            tracing::debug!("Progress emitted: {}%", progress.overall_progress);
        }
        tracing::info!("Progress channel closed");
    });

    // 在后台任务中执行下载
    let window_for_download = window.clone();

    tauri::async_runtime::spawn(async move {
        // 直接执行下载（不使用 state 存储，避免锁问题）
        let result = download_manager.start().await;

        // 重要：先掉落 download_manager，这样 progress_tx 会被关闭，progress_rx.recv() 才能结束
        drop(download_manager);

        // 现在等待进度通道关闭
        progress_handle.await.ok();

        match result {
            Ok(download_result) => {
                let success = download_result.failed_count == 0;
                let _ = window_for_download.emit(
                    "download:complete",
                    serde_json::json!({
                        "success": success,
                        "message": if success {
                            format!("下载完成，成功 {} 个文件", download_result.success_count)
                        } else {
                            format!("下载完成，成功 {} 个，失败 {} 个", download_result.success_count, download_result.failed_count)
                        }
                    }),
                );
            }
            Err(e) => {
                tracing::error!("Download failed: {}", e);
                let _ = window_for_download.emit("download:error", format!("下载失败: {}", e));
            }
        }
    });

    Ok(IpcResponse::success(()))
}

// 暂停下载
#[tauri::command]
async fn pause_download(state: State<'_, AppState>) -> Result<IpcResponse<()>, String> {
    let manager_guard = state.download_manager.lock().await;
    if let Some(ref manager) = *manager_guard {
        manager.pause();
        Ok(IpcResponse::success(()))
    } else {
        Ok(IpcResponse::error("没有正在进行的下载任务"))
    }
}

// 继续下载
#[tauri::command]
async fn resume_download(
    _window: WebviewWindow,
    _state: State<'_, AppState>,
) -> Result<IpcResponse<()>, String> {
    // 简化为重新开始
    // 实际应该恢复之前的下载管理器状态
    Ok(IpcResponse::success(()))
}

// 取消下载
#[tauri::command]
async fn cancel_download(state: State<'_, AppState>) -> Result<IpcResponse<()>, String> {
    let manager_guard = state.download_manager.lock().await;
    if let Some(ref manager) = *manager_guard {
        manager.pause();
        Ok(IpcResponse::success(()))
    } else {
        Ok(IpcResponse::success(()))
    }
}

// 重试失败的任务
#[tauri::command]
async fn retry_failed(
    window: WebviewWindow,
    state: State<'_, AppState>,
    download_dir: String,
) -> Result<IpcResponse<()>, String> {
    // 获取当前检查点
    let checkpoint = {
        let manager = &state.checkpoint_manager;
        match manager.list_all() {
            Ok(checkpoints) => checkpoints
                .into_iter()
                .filter(|c| !c.failed_tasks.is_empty())
                .max_by_key(|c| c.timestamp),
            Err(_) => None,
        }
    };

    if let Some(checkpoint) = checkpoint {
        // 清除失败状态，重新下载
        let config = checkpoint.config;
        start_download(window, state, config, download_dir).await
    } else {
        Ok(IpcResponse::error("没有可重试的失败任务"))
    }
}

// 打开目录
#[tauri::command]
async fn open_directory(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    // 初始化日志
    tracing_subscriber::fmt::init();

    // 获取检查点存储路径
    let checkpoint_path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pico-export-desktop")
        .join("checkpoints");

    // 创建检查点管理器
    let checkpoint_manager =
        CheckpointManager::new(&checkpoint_path).expect("Failed to create checkpoint manager");

    // 清理过期检查点
    if let Ok(count) = checkpoint_manager.cleanup_expired() {
        if count > 0 {
            tracing::info!("Cleaned up {} expired checkpoints", count);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            checkpoint_manager: Arc::new(checkpoint_manager),
            download_manager: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            load_checkpoint,
            clear_checkpoint,
            start_download,
            pause_download,
            resume_download,
            cancel_download,
            open_directory,
            retry_failed,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
