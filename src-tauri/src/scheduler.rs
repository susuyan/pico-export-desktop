use crate::config::{BatchStrategy, DownloadConfig, DownloadTask};

/// 批次信息
#[derive(Debug, Clone)]
pub struct Batch {
    pub index: usize,
    pub tasks: Vec<DownloadTask>,
}

/// 任务调度器
pub struct TaskScheduler {
    strategy: BatchStrategy,
}

impl TaskScheduler {
    /// 创建新的调度器
    pub fn new(strategy: BatchStrategy) -> Self {
        Self { strategy }
    }

    /// 从配置创建调度器（使用推荐策略）
    pub fn from_config(config: &DownloadConfig) -> Self {
        let strategy = config.get_recommended_strategy();
        Self::new(strategy)
    }

    /// 创建批次
    pub fn create_batches(&self, tasks: &[DownloadTask]) -> Vec<Batch> {
        let batch_size = self.strategy.batch_size.max(1);

        tasks
            .chunks(batch_size)
            .enumerate()
            .map(|(index, chunk)| Batch {
                index,
                tasks: chunk.to_vec(),
            })
            .collect()
    }

    /// 获取批次数量
    pub fn batch_count(&self, total_tasks: usize) -> usize {
        let batch_size = self.strategy.batch_size.max(1);
        (total_tasks + batch_size - 1) / batch_size
    }

    /// 获取批次间隔
    pub fn batch_interval_ms(&self) -> u64 {
        self.strategy.batch_interval_ms
    }

    /// 获取并发数
    pub fn concurrent(&self) -> usize {
        self.strategy.concurrent
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_tasks(count: usize) -> Vec<DownloadTask> {
        (0..count)
            .map(|i| DownloadTask {
                id: format!("task_{}", i),
                source: format!("obs://bucket/file{}.mp4", i),
                target: format!("file{}.mp4", i),
                size: 1000,
                checksum: None,
            })
            .collect()
    }

    #[test]
    fn test_create_batches() {
        let strategy = BatchStrategy {
            batch_size: 10,
            concurrent: 5,
            batch_interval_ms: 2000,
        };
        let scheduler = TaskScheduler::new(strategy);
        let tasks = create_test_tasks(25);
        let batches = scheduler.create_batches(&tasks);

        assert_eq!(batches.len(), 3);
        assert_eq!(batches[0].tasks.len(), 10);
        assert_eq!(batches[1].tasks.len(), 10);
        assert_eq!(batches[2].tasks.len(), 5);
    }

    #[test]
    fn test_batch_count() {
        let strategy = BatchStrategy {
            batch_size: 100,
            concurrent: 5,
            batch_interval_ms: 2000,
        };
        let scheduler = TaskScheduler::new(strategy);

        assert_eq!(scheduler.batch_count(50), 1);
        assert_eq!(scheduler.batch_count(100), 1);
        assert_eq!(scheduler.batch_count(101), 2);
        assert_eq!(scheduler.batch_count(250), 3);
    }
}
