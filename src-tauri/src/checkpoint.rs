use crate::config::{DownloadConfig, DownloadTask};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// 检查点数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointData {
    pub export_id: String,
    pub config: DownloadConfig,
    pub completed_tasks: Vec<String>,
    pub failed_tasks: Vec<String>,
    pub current_batch_index: usize,
    pub timestamp: i64,
}

impl CheckpointData {
    /// 创建新的检查点
    pub fn new(export_id: String, config: DownloadConfig) -> Self {
        Self {
            export_id,
            config,
            completed_tasks: Vec::new(),
            failed_tasks: Vec::new(),
            current_batch_index: 0,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }

    /// 添加已完成的任务
    pub fn add_completed(&mut self, task_id: String) {
        if !self.completed_tasks.contains(&task_id) {
            self.completed_tasks.push(task_id);
        }
    }

    /// 添加失败的任务
    pub fn add_failed(&mut self, task_id: String) {
        if !self.failed_tasks.contains(&task_id) {
            self.failed_tasks.push(task_id);
        }
    }

    /// 从失败列表中移除（重试成功）
    pub fn remove_failed(&mut self, task_id: &str) {
        self.failed_tasks.retain(|id| id != task_id);
    }

    /// 设置当前批次索引
    pub fn set_batch_index(&mut self, index: usize) {
        self.current_batch_index = index;
        self.timestamp = chrono::Utc::now().timestamp_millis();
    }

    /// 获取未完成的任务
    pub fn get_pending_tasks(&self) -> Vec<DownloadTask> {
        let completed: HashSet<_> = self.completed_tasks.iter().cloned().collect();
        self.config
            .tasks
            .iter()
            .filter(|t| !completed.contains(&t.id))
            .cloned()
            .collect()
    }

    /// 获取进度百分比
    pub fn progress_percent(&self) -> f64 {
        if self.config.tasks.is_empty() {
            return 0.0;
        }
        (self.completed_tasks.len() as f64 / self.config.tasks.len() as f64) * 100.0
    }

    /// 序列化为 JSON
    pub fn to_json(&self) -> anyhow::Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// 从 JSON 反序列化
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        Ok(serde_json::from_str(json)?)
    }
}

/// 检查点管理器
pub struct CheckpointManager {
    db: sled::Db,
}

impl CheckpointManager {
    /// 创建新的检查点管理器
    pub fn new<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let db = sled::open(path)?;
        Ok(Self { db })
    }

    /// 保存检查点
    pub fn save(&self, checkpoint: &CheckpointData) -> anyhow::Result<()> {
        let key = checkpoint.export_id.as_bytes();
        let value = checkpoint.to_json()?.as_bytes().to_vec();
        self.db.insert(key, value)?;
        self.db.flush()?;
        Ok(())
    }

    /// 加载检查点
    pub fn load(&self, export_id: &str) -> anyhow::Result<Option<CheckpointData>> {
        match self.db.get(export_id.as_bytes())? {
            Some(value) => {
                let json = String::from_utf8(value.to_vec())?;
                let checkpoint = CheckpointData::from_json(&json)?;
                Ok(Some(checkpoint))
            }
            None => Ok(None),
        }
    }

    /// 删除检查点
    pub fn delete(&self, export_id: &str) -> anyhow::Result<()> {
        self.db.remove(export_id.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    /// 列出所有检查点
    pub fn list_all(&self) -> anyhow::Result<Vec<CheckpointData>> {
        let mut checkpoints = Vec::new();
        for item in self.db.iter() {
            let (_, value) = item?;
            let json = String::from_utf8(value.to_vec())?;
            if let Ok(checkpoint) = CheckpointData::from_json(&json) {
                checkpoints.push(checkpoint);
            }
        }
        Ok(checkpoints)
    }

    /// 清理过期的检查点（超过 7 天）
    pub fn cleanup_expired(&self) -> anyhow::Result<usize> {
        let now = chrono::Utc::now().timestamp_millis();
        let seven_days = 7 * 24 * 60 * 60 * 1000;
        let mut count = 0;

        for item in self.db.iter() {
            let (key, value) = item?;
            let json = String::from_utf8(value.to_vec())?;
            if let Ok(checkpoint) = CheckpointData::from_json(&json) {
                if now - checkpoint.timestamp > seven_days {
                    self.db.remove(key)?;
                    count += 1;
                }
            }
        }

        if count > 0 {
            self.db.flush()?;
        }

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AuthInfo, BatchStrategy};

    fn create_test_config() -> DownloadConfig {
        DownloadConfig {
            version: "2.0".to_string(),
            export_id: "test_export".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            expires_at: (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339(),
            endpoint: "obs.example.com".to_string(),
            bucket: "test-bucket".to_string(),
            auth: AuthInfo {
                ak: "test-ak".to_string(),
                sk: "test-sk".to_string(),
                token: "test-token".to_string(),
            },
            tasks: vec![
                DownloadTask {
                    id: "task_1".to_string(),
                    source: "obs://bucket/file1.mp4".to_string(),
                    target: "file1.mp4".to_string(),
                    size: 1000,
                    checksum: None,
                },
                DownloadTask {
                    id: "task_2".to_string(),
                    source: "obs://bucket/file2.mp4".to_string(),
                    target: "file2.mp4".to_string(),
                    size: 2000,
                    checksum: None,
                },
            ],
            total_files: 2,
            total_size: 3000,
            suggested_strategy: BatchStrategy {
                batch_size: 10,
                concurrent: 5,
                batch_interval_ms: 0,
            },
        }
    }

    #[test]
    fn test_checkpoint_progress() {
        let config = create_test_config();
        let mut checkpoint = CheckpointData::new("test".to_string(), config);

        assert_eq!(checkpoint.progress_percent(), 0.0);

        checkpoint.add_completed("task_1".to_string());
        assert_eq!(checkpoint.progress_percent(), 50.0);

        checkpoint.add_completed("task_2".to_string());
        assert_eq!(checkpoint.progress_percent(), 100.0);
    }

    #[test]
    fn test_checkpoint_serde() {
        let config = create_test_config();
        let checkpoint = CheckpointData::new("test".to_string(), config);

        let json = checkpoint.to_json().unwrap();
        let restored = CheckpointData::from_json(&json).unwrap();

        assert_eq!(restored.export_id, checkpoint.export_id);
        assert_eq!(
            restored.completed_tasks.len(),
            checkpoint.completed_tasks.len()
        );
    }
}
