use serde::{Deserialize, Serialize};
use std::path::Path;

/// 认证信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthInfo {
    pub ak: String,
    pub sk: String,
    pub token: String,
}

/// 下载任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub source: String,
    pub target: String,
    pub size: u64,
    pub checksum: Option<String>,
}

/// 批次策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchStrategy {
    pub batch_size: usize,
    pub concurrent: usize,
    pub batch_interval_ms: u64,
}

/// 下载配置（JSON 配置 V2.0）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadConfig {
    pub version: String,
    pub export_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub endpoint: String,
    pub bucket: String,
    pub auth: AuthInfo,
    pub tasks: Vec<DownloadTask>,
    pub total_files: usize,
    pub total_size: u64,
    pub suggested_strategy: BatchStrategy,
}

impl DownloadConfig {
    /// 从 JSON 文件加载配置
    pub fn from_file<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: DownloadConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// 验证配置是否过期
    pub fn is_expired(&self) -> bool {
        if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(&self.expires_at) {
            expires < chrono::Utc::now()
        } else {
            false
        }
    }

    /// 根据文件数量获取推荐的批次策略
    pub fn get_recommended_strategy(&self) -> BatchStrategy {
        let total = self.tasks.len();

        match total {
            0..=100 => BatchStrategy {
                batch_size: total,
                concurrent: 5,
                batch_interval_ms: 0,
            },
            101..=500 => BatchStrategy {
                batch_size: 50,
                concurrent: 5,
                batch_interval_ms: 2000,
            },
            501..=2000 => BatchStrategy {
                batch_size: 100,
                concurrent: 5,
                batch_interval_ms: 2000,
            },
            _ => BatchStrategy {
                batch_size: 200,
                concurrent: 3,
                batch_interval_ms: 5000,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_recommended_strategy() {
        let config = DownloadConfig {
            version: "2.0".to_string(),
            export_id: "test".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            expires_at: (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339(),
            endpoint: "obs.example.com".to_string(),
            bucket: "test-bucket".to_string(),
            auth: AuthInfo {
                ak: "test-ak".to_string(),
                sk: "test-sk".to_string(),
                token: "test-token".to_string(),
            },
            tasks: vec![],
            total_files: 0,
            total_size: 0,
            suggested_strategy: BatchStrategy {
                batch_size: 10,
                concurrent: 5,
                batch_interval_ms: 0,
            },
        };

        // 测试小批量
        let strategy = config.get_recommended_strategy();
        assert_eq!(strategy.batch_size, 0);
        assert_eq!(strategy.concurrent, 5);
    }
}
