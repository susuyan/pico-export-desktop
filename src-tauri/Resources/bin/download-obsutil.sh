#!/bin/bash
# 下载 obsutil 脚本 - 根据平台自动下载对应版本

set -e

PLATFORM=$(uname -s)
ARCH=$(uname -m)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "检测到平台: $PLATFORM, 架构: $ARCH"

case "$PLATFORM" in
  Darwin)
    # macOS
    if [ "$ARCH" = "arm64" ]; then
      URL="https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_arm64.tar.gz"
    else
      URL="https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_amd64.tar.gz"
    fi
    ;;
  Linux)
    # Linux
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      URL="https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_arm64.tar.gz"
    else
      URL="https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_amd64.tar.gz"
    fi
    ;;
  CYGWIN*|MINGW*|MSYS*)
    # Windows
    URL="https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_windows_amd64.zip"
    echo "Windows 平台请手动下载并解压: $URL"
    exit 0
    ;;
  *)
    echo "不支持的平台: $PLATFORM"
    exit 1
    ;;
esac

echo "下载地址: $URL"
cd "$SCRIPT_DIR"

# 清理旧文件
rm -f obsutil.tar.gz obsutil.zip

# 下载
echo "正在下载 obsutil..."
if command -v curl &> /dev/null; then
  curl -L -o obsutil.tar.gz "$URL"
else
  wget -O obsutil.tar.gz "$URL"
fi

# 解压
echo "正在解压..."
tar -xzf obsutil.tar.gz

# 找到 obsutil 二进制文件
OBSUTIL_DIR=$(find . -name "obsutil" -type d | head -1)
if [ -n "$OBSUTIL_DIR" ]; then
  cp "$OBSUTIL_DIR/obsutil" ./obsutil
  chmod +x ./obsutil
  rm -rf "$OBSUTIL_DIR"
fi

# 清理
rm -f obsutil.tar.gz

# 验证
if [ -f "./obsutil" ]; then
  echo "✅ obsutil 下载成功"
  ./obsutil version
else
  echo "❌ 下载失败，请手动下载: $URL"
  exit 1
fi
