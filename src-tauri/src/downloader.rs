use crate::checkpoint::{CheckpointData, CheckpointManager};
use crate::config::{AuthInfo, DownloadConfig, DownloadTask};
use crate::obs_client::{check_obsutil, download_with_obsutil};
use crate::scheduler::{Batch, TaskScheduler};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

/// 文件下载状态
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileStatus {
    Pending,
    Downloading,
    Completed,
    Failed(String),
}

/// 文件进度
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileProgress {
    pub task_id: String,
    pub filename: String,
    pub status: FileStatus,
    pub progress: f64,
    pub speed: Option<u64>,
}

/// 批次信息
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchInfo {
    pub batch_index: usize,
    pub total_batches: usize,
    pub files_in_batch: usize,
    pub completed_files: usize,
}

/// 下载进度
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub total_files: usize,
    pub completed_files: usize,
    pub failed_files: usize,
    pub total_size: u64,
    pub downloaded_size: u64,
    pub current_batch: BatchInfo,
    pub file_progress: Vec<FileProgress>,
    pub overall_progress: f64,
    pub speed: u64,
    pub remaining_time: u64,
    pub status: String,
}

/// 下载结果
#[derive(Debug)]
pub struct DownloadResult {
    pub success_count: usize,
    pub failed_count: usize,
    pub failed_tasks: Vec<String>,
}

/// 下载管理器
pub struct DownloadManager {
    config: DownloadConfig,
    scheduler: TaskScheduler,
    checkpoint_manager: Arc<CheckpointManager>,
    checkpoint: CheckpointData,
    download_dir: PathBuf,
    running: Arc<AtomicBool>,
    progress_tx: Option<mpsc::Sender<DownloadProgress>>,
}

impl DownloadManager {
    /// 创建新的下载管理器
    pub fn new(
        config: DownloadConfig,
        download_dir: PathBuf,
        checkpoint_manager: Arc<CheckpointManager>,
    ) -> anyhow::Result<Self> {
        let scheduler = TaskScheduler::from_config(&config);

        // 尝试加载已有检查点，否则创建新的
        let checkpoint = checkpoint_manager
            .load(&config.export_id)?
            .unwrap_or_else(|| CheckpointData::new(config.export_id.clone(), config.clone()));

        // 检查 obsutil 是否可用
        if !check_obsutil() {
            return Err(anyhow::anyhow!(
                "obsutil 未安装。请先安装 obsutil:\n\
                 1. 从 https://support.huaweicloud.com/utiltg-obs/obsutil_03_0001.html 下载\n\
                 2. 解压后将 obsutil 添加到系统 PATH\n\
                 3. 在终端运行 'obsutil version' 验证安装"
            ));
        }

        tracing::info!("obsutil found, using it for downloads");

        Ok(Self {
            config,
            scheduler,
            checkpoint_manager,
            checkpoint,
            download_dir,
            running: Arc::new(AtomicBool::new(false)),
            progress_tx: None,
        })
    }

    /// 设置进度发送器
    pub fn set_progress_sender(&mut self, tx: mpsc::Sender<DownloadProgress>) {
        self.progress_tx = Some(tx);
    }

    /// 开始下载
    pub async fn start(&mut self) -> anyhow::Result<DownloadResult> {
        self.running.store(true, Ordering::SeqCst);

        // 获取待下载的任务
        let pending_tasks = self.checkpoint.get_pending_tasks();
        let batches = self.scheduler.create_batches(&pending_tasks);
        let total_batches = batches.len();
        let total_files = self.config.tasks.len();

        tracing::info!(
            "Starting download: {} total files, {} pending files, {} batches",
            total_files,
            pending_tasks.len(),
            total_batches
        );

        let mut success_count = self.checkpoint.completed_tasks.len();
        let mut failed_count = self.checkpoint.failed_tasks.len();

        // 发送初始进度
        self.send_initial_progress(total_files, total_batches).await;
        tracing::info!("Initial progress sent");

        for (idx, batch) in batches.iter().enumerate() {
            if !self.running.load(Ordering::SeqCst) {
                break;
            }

            // 更新当前批次索引
            self.checkpoint.set_batch_index(idx);
            self.checkpoint_manager.save(&self.checkpoint)?;

            // 执行批次下载
            let batch_result = self.download_batch(batch, idx, total_batches).await;

            match batch_result {
                Ok(results) => {
                    for (task_id, success, _error) in results {
                        if success {
                            self.checkpoint.add_completed(task_id);
                            success_count += 1;
                        } else {
                            self.checkpoint.add_failed(task_id);
                            failed_count += 1;
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Batch {} download error: {}", idx, e);
                    // 批次失败，标记该批次所有任务为失败
                    for task in &batch.tasks {
                        if !self.checkpoint.completed_tasks.contains(&task.id) {
                            self.checkpoint.add_failed(task.id.clone());
                            failed_count += 1;
                        }
                    }
                }
            }

            // 发送进度更新
            self.send_progress(success_count, failed_count, idx, total_batches, batch)
                .await;

            // 批次间停顿
            if idx < total_batches - 1 {
                let interval = self.scheduler.batch_interval_ms();
                if interval > 0 {
                    sleep(Duration::from_millis(interval)).await;
                }
            }

            // 保存进度
            self.checkpoint_manager.save(&self.checkpoint)?;
        }

        self.running.store(false, Ordering::SeqCst);

        // 如果全部完成，删除检查点
        if success_count >= self.config.tasks.len() {
            let _ = self.checkpoint_manager.delete(&self.config.export_id);
        }

        Ok(DownloadResult {
            success_count,
            failed_count,
            failed_tasks: self.checkpoint.failed_tasks.clone(),
        })
    }

    /// 发送初始进度
    async fn send_initial_progress(&self, total_files: usize, total_batches: usize) {
        if let Some(ref tx) = self.progress_tx {
            let file_progress: Vec<FileProgress> = self
                .config
                .tasks
                .iter()
                .map(|task| {
                    let status = if self.checkpoint.completed_tasks.contains(&task.id) {
                        FileStatus::Completed
                    } else if self.checkpoint.failed_tasks.contains(&task.id) {
                        FileStatus::Failed("Download failed".to_string())
                    } else {
                        FileStatus::Pending
                    };

                    FileProgress {
                        task_id: task.id.clone(),
                        filename: task
                            .target
                            .split('/')
                            .last()
                            .unwrap_or(&task.target)
                            .to_string(),
                        status,
                        progress: 0.0,
                        speed: None,
                    }
                })
                .collect();

            let batch_info = BatchInfo {
                batch_index: 0,
                total_batches,
                files_in_batch: 0,
                completed_files: 0,
            };

            let progress = DownloadProgress {
                total_files,
                completed_files: self.checkpoint.completed_tasks.len(),
                failed_files: self.checkpoint.failed_tasks.len(),
                total_size: self.config.total_size,
                downloaded_size: 0,
                current_batch: batch_info,
                file_progress,
                overall_progress: 0.0,
                speed: 0,
                remaining_time: 0,
                status: "downloading".to_string(),
            };

            let _ = tx.send(progress).await;
        }
    }

    /// 发送进度更新
    async fn send_progress(
        &self,
        completed_files: usize,
        failed_files: usize,
        current_batch_idx: usize,
        total_batches: usize,
        current_batch: &Batch,
    ) {
        if let Some(ref tx) = self.progress_tx {
            let total_files = self.config.tasks.len();
            let overall_progress = if total_files > 0 {
                (completed_files as f64 / total_files as f64) * 100.0
            } else {
                0.0
            };

            let file_progress: Vec<FileProgress> = self
                .config
                .tasks
                .iter()
                .map(|task| {
                    let is_completed = self.checkpoint.completed_tasks.contains(&task.id);
                    let is_failed = self.checkpoint.failed_tasks.contains(&task.id);

                    let (status, progress) = if is_completed {
                        (FileStatus::Completed, 100.0)
                    } else if is_failed {
                        (FileStatus::Failed("Download failed".to_string()), 0.0)
                    } else {
                        (FileStatus::Pending, 0.0)
                    };

                    FileProgress {
                        task_id: task.id.clone(),
                        filename: task
                            .target
                            .split('/')
                            .last()
                            .unwrap_or(&task.target)
                            .to_string(),
                        status,
                        progress,
                        speed: None,
                    }
                })
                .collect();

            // 计算当前批次已完成数量
            let completed_in_batch = current_batch
                .tasks
                .iter()
                .filter(|t| self.checkpoint.completed_tasks.contains(&t.id))
                .count();

            let batch_info = BatchInfo {
                batch_index: current_batch_idx,
                total_batches,
                files_in_batch: current_batch.tasks.len(),
                completed_files: completed_in_batch,
            };

            let progress = DownloadProgress {
                total_files,
                completed_files,
                failed_files,
                total_size: self.config.total_size,
                downloaded_size: 0,
                current_batch: batch_info,
                file_progress,
                overall_progress,
                speed: 0,
                remaining_time: 0,
                status: if self.running.load(Ordering::SeqCst) {
                    "downloading".to_string()
                } else {
                    "paused".to_string()
                },
            };

            let _ = tx.send(progress).await;
        }
    }

    /// 下载单个批次
    async fn download_batch(
        &self,
        batch: &Batch,
        batch_index: usize,
        total_batches: usize,
    ) -> anyhow::Result<Vec<(String, bool, Option<String>)>> {
        let concurrent = self.scheduler.concurrent();
        let mut results = Vec::new();

        // 使用信号量限制并发数
        let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrent));
        let mut handles = Vec::new();

        for task in &batch.tasks {
            let permit = semaphore.clone().acquire_owned().await?;
            let task = task.clone();
            let download_dir = self.download_dir.clone();
            let auth = self.config.auth.clone();
            let endpoint = self.config.endpoint.clone();
            let bucket = self.config.bucket.clone();
            let running = self.running.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit; // 持有信号量许可直到任务完成

                if !running.load(Ordering::SeqCst) {
                    return (task.id.clone(), false, Some("Cancelled".to_string()));
                }

                // 尝试下载，带重试机制
                let result = download_with_retry(
                    &task,
                    &download_dir,
                    &auth,
                    &endpoint,
                    &bucket,
                    3, // 重试 3 次
                )
                .await;

                match result {
                    Ok(_) => (task.id.clone(), true, None),
                    Err(e) => (task.id.clone(), false, Some(e.to_string())),
                }
            });

            handles.push(handle);
        }

        // 等待所有任务完成
        for handle in handles {
            match handle.await {
                Ok(result) => results.push(result),
                Err(e) => {
                    tracing::error!("Task join error: {}", e);
                    results.push(("unknown".to_string(), false, Some(e.to_string())));
                }
            }
        }

        Ok(results)
    }

    /// 暂停下载
    pub fn pause(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// 是否正在运行
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

/// 带重试的下载函数
async fn download_with_retry(
    task: &DownloadTask,
    download_dir: &PathBuf,
    auth: &AuthInfo,
    endpoint: &str,
    bucket: &str,
    max_retries: u32,
) -> anyhow::Result<()> {
    let mut last_error = None;

    for attempt in 1..=max_retries {
        tracing::info!(
            "Downloading {} (attempt {}/{})",
            task.id,
            attempt,
            max_retries
        );

        let result = download_with_obsutil(task, download_dir, auth, endpoint, bucket).await;

        match result {
            Ok(_) => return Ok(()),
            Err(e) => {
                tracing::warn!("Download attempt {} failed: {}", attempt, e);
                last_error = Some(e);

                if attempt < max_retries {
                    // 等待后重试
                    let delay = Duration::from_secs(2u64.pow(attempt - 1));
                    tracing::info!("Retrying after {:?}...", delay);
                    sleep(delay).await;
                }
            }
        }
    }

    Err(anyhow::anyhow!(
        "Download failed after {} attempts: {}",
        max_retries,
        last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error"))
    ))
}
