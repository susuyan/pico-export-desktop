use std::process::Command;

/// 获取 obsutil 路径
pub fn get_obsutil_path() -> Option<String> {
    // 首先检查环境变量
    if let Ok(path) = std::env::var("OBSUTIL_PATH") {
        if std::path::Path::new(&path).exists() {
            return Some(path);
        }
    }

    // 检查当前目录
    let current_dir_obsutil = if cfg!(target_os = "windows") {
        "./obsutil.exe"
    } else {
        "./obsutil"
    };

    if std::path::Path::new(current_dir_obsutil).exists() {
        return Some(current_dir_obsutil.to_string());
    }

    // 检查 PATH
    if let Ok(output) = Command::new("which").arg("obsutil").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}

/// 下载并安装 obsutil
pub async fn install_obsutil() -> anyhow::Result<String> {
    // 根据平台确定下载 URL
    let (url, filename) = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "arm64") {
            (
                "https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_arm64.tar.gz",
                "obsutil_darwin_arm64.tar.gz",
            )
        } else {
            (
                "https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_amd64.tar.gz",
                "obsutil_darwin_amd64.tar.gz",
            )
        }
    } else if cfg!(target_os = "windows") {
        (
            "https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_windows64.zip",
            "obsutil_windows64.zip",
        )
    } else {
        (
            "https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_amd64.tar.gz",
            "obsutil_linux_amd64.tar.gz",
        )
    };

    // 下载文件
    let response = reqwest::get(url).await?;
    let bytes = response.bytes().await?;

    // 保存到临时目录
    let temp_dir = std::env::temp_dir();
    let archive_path = temp_dir.join(filename);
    tokio::fs::write(&archive_path, bytes).await?;

    // 解压
    let install_dir = dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap())
        .join("pico-export-desktop")
        .join("obsutil");

    tokio::fs::create_dir_all(&install_dir).await?;

    if filename.ends_with(".tar.gz") {
        // 使用 tar 解压
        let output = Command::new("tar")
            .args(&["-xzf", archive_path.to_str().unwrap(), "-C", install_dir.to_str().unwrap()])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!("Failed to extract archive"));
        }
    } else if filename.ends_with(".zip") {
        // 使用 unzip 解压
        let output = Command::new("unzip")
            .args(&["-o", archive_path.to_str().unwrap(), "-d", install_dir.to_str().unwrap()])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!("Failed to extract archive"));
        }
    }

    // 清理临时文件
    let _ = tokio::fs::remove_file(archive_path).await;

    // 查找 obsutil 可执行文件
    let obsutil_path = find_obsutil_binary(&install_dir)?;

    Ok(obsutil_path)
}

/// 在目录中查找 obsutil 二进制文件
fn find_obsutil_binary(dir: &std::path::Path) -> anyhow::Result<String> {
    let obsutil_name = if cfg!(target_os = "windows") {
        "obsutil.exe"
    } else {
        "obsutil"
    };

    for entry in walkdir::WalkDir::new(dir) {
        let entry = entry?;
        if entry.file_name() == obsutil_name {
            return Ok(entry.path().to_string_lossy().to_string());
        }
    }

    Err(anyhow::anyhow!("obsutil binary not found in extracted archive"))
}
