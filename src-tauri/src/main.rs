// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, Window};
use tokio::sync::mpsc;

mod checkpoint;
mod commands;
mod config;
mod downloader;
mod scheduler;

use checkpoint::{CheckpointData, CheckpointManager};
use config::DownloadConfig;
use downloader::{DownloadManager, DownloadProgress};

// 应用状态
struct AppState {
    checkpoint_manager: Mutex<CheckpointManager>,
    download_manager: Mutex<Option<DownloadManager>>,
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
    let manager = state.checkpoint_manager.lock().map_err(|e| e.to_string())?;

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
    let manager = state.checkpoint_manager.lock().map_err(|e| e.to_string())?;

    match manager.delete(&export_id) {
        Ok(_) => Ok(IpcResponse::success(())),
        Err(e) => Ok(IpcResponse::error(format!("清除检查点失败: {}", e))),
    }
}

// 开始下载
#[tauri::command]
async fn start_download(
    window: Window,
    state: State<'_, AppState>,
    config: DownloadConfig,
    download_dir: String,
) -> Result<IpcResponse<()>, String> {
    // 创建下载目录
    let download_path = PathBuf::from(download_dir);
    if let Err(e) = tokio::fs::create_dir_all(&download_path).await {
        return Ok(IpcResponse::error(format!("创建下载目录失败: {}", e)));
    }

    // 获取检查点管理器
    let checkpoint_manager = {
        let guard = state.checkpoint_manager.lock().map_err(|e| e.to_string())?;
        // 我们需要克隆管理器或者使用其他方式
        // 这里简化处理，实际应该使用 Arc
        drop(guard);
        state
            .checkpoint_manager
            .lock()
            .map_err(|e| e.to_string())?
    };

    // 创建下载管理器
    let mut download_manager = match DownloadManager::new(
        config,
        download_path,
        checkpoint_manager,
    ) {
        Ok(manager) => manager,
        Err(e) => return Ok(IpcResponse::error(format!("创建下载管理器失败: {}", e))),
    };

    // 创建进度通道
    let (progress_tx, mut progress_rx) = mpsc::channel::<DownloadProgress>(100);
    download_manager.set_progress_sender(progress_tx);

    // 在后台任务中转发进度到前端
    let window_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            let _ = window_clone.emit("download:progress", progress);
        }
    });

    // 存储下载管理器
    {
        let mut manager_guard = state.download_manager.lock().map_err(|e| e.to_string())?;
        *manager_guard = Some(download_manager);
    }

    // 在后台任务中执行下载
    tauri::async_runtime::spawn(async move {
        let result = {
            let mut manager_guard = state.download_manager.lock().unwrap();
            if let Some(ref mut manager) = *manager_guard {
                manager.start().await
            } else {
                Err(anyhow::anyhow!("下载管理器未初始化"))
            }
        };

        match result {
            Ok(download_result) => {
                let success = download_result.failed_count == 0;
                let _ = window.emit(
                    "download:complete",
                    serde_json::json!({
                        "success": success,
                        "message": if success { "下载完成" } else { "部分文件下载失败" }
                    }),
                );
            }
            Err(e) => {
                let _ = window.emit(
                    "download:error",
                    format!("下载失败: {}", e),
                );
            }
        }
    });

    Ok(IpcResponse::success(()))
}

// 暂停下载
#[tauri::command]
async fn pause_download(state: State<'_, AppState>) -> Result<IpcResponse<()>, String> {
    let manager_guard = state.download_manager.lock().map_err(|e| e.to_string())?;
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
    window: Window,
    state: State<'_, AppState>,
) -> Result<IpcResponse<()>, String> {
    // 简化为重新开始
    // 实际应该恢复之前的下载管理器状态
    Ok(IpcResponse::success(()))
}

// 取消下载
#[tauri::command]
async fn cancel_download(state: State<'_, AppState>) -> Result<IpcResponse<()>, String> {
    let manager_guard = state.download_manager.lock().map_err(|e| e.to_string())?;
    if let Some(ref manager) = *manager_guard {
        manager.pause();
        Ok(IpcResponse::success(()))
    } else {
        Ok(IpcResponse::success(()))
    }
}

// 打开目录
#[tauri::command]
async fn open_directory(path: String) -> Result<(), String> {
    let _ = open::that_detached(path);
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
    let checkpoint_manager = CheckpointManager::new(&checkpoint_path)
        .expect("Failed to create checkpoint manager");

    // 清理过期检查点
    if let Ok(count) = checkpoint_manager.cleanup_expired() {
        if count > 0 {
            tracing::info!("Cleaned up {} expired checkpoints", count);
        }
    }

    tauri::Builder::default()
        .manage(AppState {
            checkpoint_manager: Mutex::new(checkpoint_manager),
            download_manager: Mutex::new(None),
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
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
