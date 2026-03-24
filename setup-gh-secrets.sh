#!/bin/bash
# 设置 GitHub Secrets 脚本
# 用法: ./setup-gh-secrets.sh

set -e

REPO="susuyan/pico-export-desktop"

echo "🔐 设置 GitHub Secrets for $REPO"
echo ""
echo "请按提示输入以下信息："
echo ""

# 1. APPLE_CERTIFICATE (Base64 编码的 p12)
echo "1. APPLE_CERTIFICATE"
echo "   请运行: base64 -i your_certificate.p12"
echo "   然后粘贴输出内容:"
read -r -d '' CERT_CONTENT << 'EOF'
PASTE_YOUR_BASE64_CERTIFICATE_HERE
EOF
echo "$CERT_CONTENT" | gh secret set APPLE_CERTIFICATE -R "$REPO" --body "-"

echo ""

# 2. APPLE_CERTIFICATE_PASSWORD
read -s -p "2. APPLE_CERTIFICATE_PASSWORD (p12导出密码): " CERT_PASSWORD
echo ""
echo "$CERT_PASSWORD" | gh secret set APPLE_CERTIFICATE_PASSWORD -R "$REPO" --body "-"
unset CERT_PASSWORD

echo ""

# 3. APPLE_SIGNING_IDENTITY
read -p "3. APPLE_SIGNING_IDENTITY (如 'Developer ID Application: Your Name (TEAM_ID)'): " SIGNING_IDENTITY
echo "$SIGNING_IDENTITY" | gh secret set APPLE_SIGNING_IDENTITY -R "$REPO" --body "-"

echo ""

# 4. APPLE_ID
read -p "4. APPLE_ID (你的 Apple ID 邮箱): " APPLE_ID
echo "$APPLE_ID" | gh secret set APPLE_ID -R "$REPO" --body "-"

echo ""

# 5. APPLE_APP_SPECIFIC_PASSWORD
read -s -p "5. APPLE_APP_SPECIFIC_PASSWORD (从 appleid.apple.com 生成): " APP_PASSWORD
echo ""
echo "$APP_PASSWORD" | gh secret set APPLE_APP_SPECIFIC_PASSWORD -R "$REPO" --body "-"
unset APP_PASSWORD

echo ""

# 6. APPLE_TEAM_ID
read -p "6. APPLE_TEAM_ID (10位团队ID，如 ABCD123456): " TEAM_ID
echo "$TEAM_ID" | gh secret set APPLE_TEAM_ID -R "$REPO" --body "-"

echo ""

# 7. KEYCHAIN_PASSWORD (随机生成)
KEYCHAIN_PASSWORD=$(openssl rand -base64 32)
echo "7. KEYCHAIN_PASSWORD (自动生成)"
echo "$KEYCHAIN_PASSWORD" | gh secret set KEYCHAIN_PASSWORD -R "$REPO" --body "-"

echo ""
echo "✅ 所有 Secrets 设置完成！"
echo ""
echo "验证命令: gh secret list -R $REPO"
