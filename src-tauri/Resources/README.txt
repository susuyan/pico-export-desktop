obsutil 工具目录
================

本目录用于存放华为云 OBS 命令行工具 obsutil。

自动下载
--------
macOS/Linux 用户可运行以下命令自动下载：
  chmod +x download-obsutil.sh
  ./download-obsutil.sh

手动下载
--------
如果自动下载失败，请根据平台手动下载对应版本：

【macOS】
- Intel (x86_64): https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_amd64.tar.gz
- Apple Silicon (ARM64): https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_arm64.tar.gz

【Linux】
- x86_64: https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_amd64.tar.gz
- ARM64: https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_arm64.tar.gz

【Windows】
- x86_64: https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_windows_amd64.zip

安装步骤
--------
1. 下载对应平台的压缩包
2. 解压到本目录 (src-tauri/Resources/bin/)
3. 确保 obsutil 可执行文件位于：
   - macOS/Linux: Resources/bin/obsutil
   - Windows: Resources/bin/obsutil.exe
4. macOS/Linux 需要添加执行权限：chmod +x obsutil

验证安装
--------
运行以下命令验证：
  ./obsutil version

官方文档
--------
https://support.huaweicloud.com/utiltg-obs/obsutil_03_0001.html
