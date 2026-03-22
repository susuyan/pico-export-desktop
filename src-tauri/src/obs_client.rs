use crate::config::{AuthInfo, DownloadTask};
use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

/// 获取 obsutil 可执行文件名（根据平台）
#[cfg(target_os = "windows")]
const OBSUTIL_NAME: &str = "obsutil.exe";
#[cfg(not(target_os = "windows"))]
const OBSUTIL_NAME: &str = "obsutil";

/// 获取 obsutil 路径（优先使用内嵌版本）
pub fn get_obsutil_path() -> Option<String> {
    // 1. 优先检查内嵌版本（相对于可执行文件的路径）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // 检查 .app bundle 内的 Resources/bin (Tauri 打包后的嵌套路径 - macOS)
            #[cfg(target_os = "macos")]
            {
                let embedded_path = exe_dir
                    .parent()
                    .map(|p| p.join(format!("Resources/Resources/bin/{}", OBSUTIL_NAME)))
                    .filter(|p| p.exists());

                if let Some(path) = embedded_path {
                    return path.to_str().map(|s| s.to_string());
                }

                // 检查 .app bundle 内的 Resources/bin (直接路径 - macOS)
                let embedded_path = exe_dir
                    .parent()
                    .map(|p| p.join(format!("Resources/bin/{}", OBSUTIL_NAME)))
                    .filter(|p| p.exists());

                if let Some(path) = embedded_path {
                    return path.to_str().map(|s| s.to_string());
                }
            }

            // Windows/Linux: 检查 Resources/bin 目录
            #[cfg(not(target_os = "macos"))]
            {
                let resources_path = exe_dir.join(format!("Resources/bin/{}", OBSUTIL_NAME));
                if resources_path.exists() {
                    return resources_path.to_str().map(|s| s.to_string());
                }
            }

            // 检查同级 bin 目录
            let bin_path = exe_dir.join(format!("bin/{}", OBSUTIL_NAME));
            if bin_path.exists() {
                return bin_path.to_str().map(|s| s.to_string());
            }

            // 检查直接同级目录
            let direct_path = exe_dir.join(OBSUTIL_NAME);
            if direct_path.exists() {
                return direct_path.to_str().map(|s| s.to_string());
            }
        }
    }

    // 2. 检查系统 PATH
    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 where 命令
        if let Ok(output) = std::process::Command::new("where").arg("obsutil").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix: 使用 which 命令
        if let Ok(output) = std::process::Command::new("which").arg("obsutil").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }

    // 3. 检查常见安装位置
    #[cfg(target_os = "windows")]
    let common_paths: Vec<&str> = vec![
        r"C:\Program Files\obsutil\obsutil.exe",
        r"C:\obsutil\obsutil.exe",
    ];

    #[cfg(target_os = "macos")]
    let common_paths: Vec<&str> = vec![
        "/usr/local/bin/obsutil",
        "/opt/obsutil/obsutil",
        "/usr/bin/obsutil",
    ];

    #[cfg(target_os = "linux")]
    let common_paths: Vec<&str> = vec![
        "/usr/local/bin/obsutil",
        "/opt/obsutil/obsutil",
        "/usr/bin/obsutil",
        "/bin/obsutil",
    ];

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let common_paths: Vec<&str> = vec![];

    for path in &common_paths {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    None
}

/// 检查 obsutil 是否可用
pub fn check_obsutil() -> bool {
    get_obsutil_path().is_some()
}

/// 获取 obsutil 版本信息
pub fn get_obsutil_version() -> Option<String> {
    get_obsutil_path().and_then(|path| {
        std::process::Command::new(&path)
            .arg("version")
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    String::from_utf8(output.stdout).ok()
                } else {
                    None
                }
            })
    })
}

/// 使用 obsutil 下载文件
pub async fn download_with_obsutil(
    task: &DownloadTask,
    download_dir: &PathBuf,
    auth: &AuthInfo,
    endpoint: &str,
    bucket: &str,
) -> Result<()> {
    let target_path = download_dir.join(&task.target);

    // 创建父目录
    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    // 获取 obsutil 路径
    let obsutil_path = get_obsutil_path().ok_or_else(|| {
        anyhow!(
            "obsutil 未找到。请按以下方式之一解决：\n\
             1. 将 obsutil 放入应用 bin 目录\n\
             2. 将 obsutil 添加到系统 PATH\n\
             3. 从 https://support.huaweicloud.com/utiltg-obs/obsutil_03_0001.html 下载"
        )
    })?;

    // 提取 object key
    let object_key = task.source.trim_start_matches(&format!("obs://{}/", bucket));
    let source_url = format!("obs://{}/{}", bucket, object_key);

    tracing::info!(
        "Downloading with obsutil ({}): {} -> {:?}",
        obsutil_path,
        source_url,
        target_path
    );

    // 构建 obsutil 命令
    // obsutil cp -f -u -i=<ak> -k=<sk> -e=<endpoint> <source> <target>
    let output = Command::new(&obsutil_path)
        .args(&[
            "cp",
            "-f",
            "-u",
            &format!("-i={}", auth.ak),
            &format!("-k={}", auth.sk),
            &format!("-e={}", endpoint),
            &source_url,
            target_path.to_str().unwrap(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(output) => {
            if output.status.success() {
                tracing::info!("Download completed: {:?}", target_path);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                Err(anyhow!(
                    "obsutil 下载失败:\nstdout: {}\nstderr: {}",
                    stdout,
                    stderr
                ))
            }
        }
        Err(e) => Err(anyhow!("obsutil 执行失败: {}", e))
    }
}

/// 使用 obsutil 批量下载（更高效）
pub async fn batch_download_with_obsutil(
    tasks: &[DownloadTask],
    download_dir: &PathBuf,
    auth: &AuthInfo,
    endpoint: &str,
    bucket: &str,
) -> Result<Vec<(String, Result<()>)>> {
    let mut results = Vec::new();

    for task in tasks {
        let result = download_with_obsutil(task, download_dir, auth, endpoint, bucket).await;
        results.push((task.id.clone(), result));
    }

    Ok(results)
}

/// 使用 obsutil 配置 ak/sk（永久配置）
pub async fn obsutil_config(
    auth: &AuthInfo,
    endpoint: &str,
) -> Result<()> {
    let obsutil_path = get_obsutil_path().ok_or_else(|| {
        anyhow!("obsutil 未找到")
    })?;

    let output = Command::new(&obsutil_path)
        .args(&[
            "config",
            &format!("-i={}", auth.ak),
            &format!("-k={}", auth.sk),
            &format!("-e={}", endpoint),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(anyhow!("obsutil config failed: {}", stderr))
            }
        }
        Err(e) => Err(anyhow!("obsutil config error: {}", e)),
    }
}
