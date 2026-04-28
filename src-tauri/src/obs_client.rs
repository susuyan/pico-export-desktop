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

/// 获取 obsutil 路径（优先使用用户安装版本）
pub fn get_obsutil_path() -> Option<String> {
    // 1. 优先检查用户安装版本（应用数据目录）
    if let Some(data_dir) = dirs::data_dir() {
        let user_install_path = data_dir
            .join("pico-export-desktop")
            .join("bin")
            .join(OBSUTIL_NAME);

        if user_install_path.exists() {
            return user_install_path.to_str().map(|s| s.to_string());
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
    #[cfg(target_os = "macos")]
    {
        // macOS: 常见位置
        let common_paths = [
            "/usr/local/bin/obsutil",
            "/opt/homebrew/bin/obsutil",
            "~/bin/obsutil",
        ];

        for path_str in common_paths {
            let path = if path_str.starts_with('~') {
                if let Some(home) = dirs::home_dir() {
                    home.join(&path_str[2..])
                } else {
                    continue;
                }
            } else {
                PathBuf::from(path_str)
            };

            if path.exists() {
                return path.to_str().map(|s| s.to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 常见位置
        if let Some(home) = dirs::home_dir() {
            let common_paths = [
                home.join("bin").join("obsutil.exe"),
                home.join("obsutil").join("obsutil.exe"),
            ];

            for path in common_paths {
                if path.exists() {
                    return path.to_str().map(|s| s.to_string());
                }
            }
        }
    }

    None
}

/// 检查 obsutil 是否已安装
pub fn check_obsutil_installed() -> bool {
    get_obsutil_path().is_some()
}

/// 获取 obsutil 安装目录
pub fn get_install_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join("pico-export-desktop").join("bin"))
}

/// 自动安装 obsutil
pub async fn install_obsutil() -> Result<()> {
    let install_dir = get_install_dir()
        .ok_or_else(|| anyhow!("无法获取安装目录"))?;

    // 创建安装目录
    std::fs::create_dir_all(&install_dir)?;

    let download_url = get_obsutil_download_url();
    if download_url.is_empty() {
        return Err(anyhow!("不支持的平台"));
    }

    tracing::info!("开始下载 obsutil: {}", download_url);

    // 创建专用临时目录（避免冲突）
    let temp_base = std::env::temp_dir();
    let temp_dir = temp_base.join("pico-export-desktop-install");
    std::fs::create_dir_all(&temp_dir)?;

    let download_file = temp_dir.join("obsutil.tar.gz");

    // 使用 curl 下载（macOS/Linux）
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("curl")
            .args(["-L", "-o", download_file.to_str().unwrap(), &download_url])
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("下载失败: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }

    tracing::info!("下载完成，开始解压...");

    // 解压文件
    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux: 使用 tar 解压到专用目录
        let output = Command::new("tar")
            .args(["-xzf", download_file.to_str().unwrap(), "-C", temp_dir.to_str().unwrap()])
            .output()
            .await?;

        if !output.status.success() {
            return Err(anyhow!("解压失败: {}", String::from_utf8_lossy(&output.stderr)));
        }

        tracing::info!("解压完成，查找 obsutil 文件...");

        // 查找解压后的 obsutil 文件
        let find_output = Command::new("find")
            .args([temp_dir.to_str().unwrap(), "-name", "obsutil", "-type", "f"])
            .output()
            .await?;

        if !find_output.status.success() {
            return Err(anyhow!("查找 obsutil 失败"));
        }

        let obsutil_path_str = String::from_utf8_lossy(&find_output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();

        if obsutil_path_str.is_empty() {
            return Err(anyhow!("找不到解压后的 obsutil 文件"));
        }

        tracing::info!("找到 obsutil: {}", obsutil_path_str);

        // 复制到安装目录
        let obsutil_path = PathBuf::from(&obsutil_path_str);
        let target_path = install_dir.join(OBSUTIL_NAME);
        std::fs::copy(&obsutil_path, &target_path)?;

        // 设置执行权限
        let chmod_output = Command::new("chmod")
            .args(["+x", target_path.to_str().unwrap()])
            .output()
            .await?;

        if !chmod_output.status.success() {
            return Err(anyhow!("设置权限失败: {}", String::from_utf8_lossy(&chmod_output.stderr)));
        }

        tracing::info!("安装完成: {}", target_path.display());

        // 清理临时目录
        std::fs::remove_dir_all(&temp_dir).ok();
    }

    Ok(())
}

/// 获取 obsutil 下载 URL（根据平台）
pub fn get_obsutil_download_url() -> String {
    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 amd64 版本（可通过 Rosetta 2 在 M1/M2/M3 上运行）
        "https://obs-community-intl.obs.ap-southeast-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_amd64.tar.gz".to_string()
    }

    #[cfg(target_os = "windows")]
    {
        "https://obs-community-intl.obs.ap-southeast-1.myhuaweicloud.com/obsutil/current/obsutil_windows_amd64.zip".to_string()
    }

    #[cfg(target_os = "linux")]
    {
        "https://obs-community-intl.obs.ap-southeast-1.myhuaweicloud.com/obsutil/current/obsutil_linux_amd64.tar.gz".to_string()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "".to_string()
    }
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
    let object_key = task
        .source
        .trim_start_matches(&format!("obs://{}/", bucket));
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
        Err(e) => Err(anyhow!("obsutil 执行失败: {}", e)),
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
pub async fn obsutil_config(auth: &AuthInfo, endpoint: &str) -> Result<()> {
    let obsutil_path = get_obsutil_path().ok_or_else(|| anyhow!("obsutil 未找到"))?;

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
