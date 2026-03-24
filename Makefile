# Sensible defaults
.ONESHELL:
SHELL := bash
.SHELLFLAGS := -e -u -c -o pipefail
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

# Derived values (DO NOT TOUCH).
CURRENT_MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
CURRENT_MAKEFILE_DIR := $(patsubst %/,%,$(dir $(CURRENT_MAKEFILE_PATH)))
TAURI_DIR := $(CURRENT_MAKEFILE_DIR)/src-tauri
DIST_DIR := $(CURRENT_MAKEFILE_DIR)/dist

# Version management
VERSION ?=
BUILD ?=

# Signing configuration (auto-detected if not set)
# Priority: Developer ID Application > Apple Distribution
SIGNING_IDENTITY ?= $(shell security find-identity -v -p codesigning 2>/dev/null | awk -F'"' '/Developer ID Application/ {print $$2; exit}')
ifndef SIGNING_IDENTITY
SIGNING_IDENTITY := $(shell security find-identity -v -p codesigning 2>/dev/null | awk -F'"' '/Apple Distribution/ {print $$2; exit}')
endif
TEAM_ID ?= $(shell echo "$(SIGNING_IDENTITY)" | grep -oE '\([A-Z0-9]{10}\)$$' | tr -d '()' 2>/dev/null)

# Default target
.DEFAULT_GOAL := help
.PHONY: help dev build sign-local sign-verify notarize bump-version bump-and-release clean release-local

help:  # Display this help.
	@-+echo "Run make with one of the following targets:"
	@-+echo
	@-+grep -Eh "^[a-z-]+:.*#" $(CURRENT_MAKEFILE_PATH) | sed -E 's/^(.*:)(.*#+)(.*)/  \1 @@@ \3 /' | column -t -s "@@@"

dev:  # Run development server
	@echo "Starting Tauri dev..."
	cd $(CURRENT_MAKEFILE_DIR) && npm run tauri:dev

build:  # Build the app (Release)
	@echo "Building Tauri app..."
	cd $(CURRENT_MAKEFILE_DIR) && npm run build
	cd $(TAURI_DIR) && cargo tauri build

build-universal:  # Build Universal macOS binary (Intel + Apple Silicon)
	@echo "Building Universal macOS binary..."
	cd $(TAURI_DIR) && cargo tauri build --target universal-apple-darwin

sign-local: build  # Sign the app locally with Developer ID
	@if [ -z "$(SIGNING_IDENTITY)" ]; then \
		echo "❌ Error: No Developer ID Application identity found"; \
		echo "Please ensure you have a Developer ID certificate in your keychain"; \
		exit 1; \
	fi; \
	IDENTITY_SHA=$$(security find-identity -v -p codesigning 2>/dev/null | grep "$$(echo "$(SIGNING_IDENTITY)" | head -c 40)" | head -1 | awk '{print $$2}'); \
	echo "🔐 Signing with identity: $(SIGNING_IDENTITY)"; \
	echo "🔐 Team ID: $(TEAM_ID)"; \
	echo "🔐 Identity SHA: $$IDENTITY_SHA"; \
	\
	APP_PATH=$$(find $(TAURI_DIR)/target/release/bundle/macos -name '*.app' -maxdepth 1 -print -quit); \
	if [ -z "$$APP_PATH" ] || [ ! -d "$$APP_PATH" ]; then \
		echo "❌ Error: Built app not found in $(TAURI_DIR)/target/release/bundle/macos"; \
		exit 1; \
	fi; \
	echo "📦 App bundle: $$APP_PATH"; \
	\
	echo "📝 Signing app bundle..."; \
	codesign --force --options runtime --sign "$$IDENTITY_SHA" --timestamp \
		--entitlements $(TAURI_DIR)/entitlements.plist \
		"$$APP_PATH"; \
	\
	echo "✅ Verifying signature..."; \
	codesign -vvv --deep --strict "$$APP_PATH"; \
	\
	echo "📋 Displaying signature info..."; \
	codesign -dvv "$$APP_PATH"

sign-verify:  # Verify app signature
	@APP_PATH=$$(find $(TAURI_DIR)/target/release/bundle/macos -name '*.app' -maxdepth 1 -print -quit); \
	if [ -z "$$APP_PATH" ] || [ ! -d "$$APP_PATH" ]; then \
		echo "❌ Error: App not found"; \
		exit 1; \
	fi; \
	echo "Verifying: $$APP_PATH"; \
	codesign -vvv --deep --strict "$$APP_PATH"

notarize: sign-local  # Notarize the signed app (requires APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD env vars)
	@if [ -z "$(APPLE_ID)" ]; then \
		echo "❌ Error: APPLE_ID environment variable not set"; \
		exit 1; \
	fi; \
	if [ -z "$(APPLE_APP_SPECIFIC_PASSWORD)" ]; then \
		echo "❌ Error: APPLE_APP_SPECIFIC_PASSWORD environment variable not set"; \
		exit 1; \
	fi; \
	\
	DMG_PATH=$$(find $(TAURI_DIR)/target/release/bundle/dmg -name '*.dmg' -maxdepth 1 -print -quit); \
	if [ -z "$$DMG_PATH" ] || [ ! -f "$$DMG_PATH" ]; then \
		echo "❌ Error: DMG not found"; \
		exit 1; \
	fi; \
	\
	echo "📤 Submitting for notarization: $$DMG_PATH"; \
	xcrun notarytool submit "$$DMG_PATH" \
		--apple-id "$(APPLE_ID)" \
		--team-id "$(TEAM_ID)" \
		--password "$(APPLE_APP_SPECIFIC_PASSWORD)" \
		--wait; \
	\
	echo "📎 Stapling ticket to DMG..."; \
	xcrun stapler staple "$$DMG_PATH"; \
	echo "✅ Notarization complete"

install-dev:  # Install development build to /Applications
	@APP_PATH=$$(find $(TAURI_DIR)/target/debug/bundle/macos -name '*.app' -maxdepth 1 -print -quit 2>/dev/null); \
	if [ -z "$$APP_PATH" ] || [ ! -d "$$APP_PATH" ]; then \
		APP_PATH=$$(find $(TAURI_DIR)/target/release/bundle/macos -name '*.app' -maxdepth 1 -print -quit 2>/dev/null); \
	fi; \
	if [ -z "$$APP_PATH" ] || [ ! -d "$$APP_PATH" ]; then \
		echo "❌ Error: App not found. Run 'make build' first."; \
		exit 1; \
	fi; \
	PRODUCT=$$(basename "$$APP_PATH"); \
	DST="/Applications/$$PRODUCT"; \
	echo "🚀 Installing $$APP_PATH -> $$DST"; \
	rm -rf "$$DST"; \
	cp -R "$$APP_PATH" "$$DST"; \
	echo "✅ Installed to $$DST"

install-release: sign-local  # Build, sign, and install release version to /Applications
	@APP_PATH=$$(find $(TAURI_DIR)/target/release/bundle/macos -name '*.app' -maxdepth 1 -print -quit); \
	PRODUCT=$$(basename "$$APP_PATH"); \
	DST="/Applications/$$PRODUCT"; \
	echo "🚀 Installing $$APP_PATH -> $$DST"; \
	rm -rf "$$DST"; \
	cp -R "$$APP_PATH" "$$DST"; \
	echo "✅ Installed release build to $$DST"

bump-version:  # Bump version (usage: make bump-version VERSION=0.0.2)
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Error: VERSION not specified"; \
		echo "Usage: make bump-version VERSION=0.0.2"; \
		exit 1; \
	fi; \
	if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "❌ Error: VERSION must be in semver format (e.g., 0.0.2)"; \
		exit 1; \
	fi; \
	\
	CARGO_FILE="$(TAURI_DIR)/Cargo.toml"; \
	PACKAGE_FILE="$(CURRENT_MAKEFILE_DIR)/package.json"; \
	\
	echo "🔢 Bumping version to $(VERSION)..."; \
	\
	# Update Cargo.toml \
	sed -i '' "s/^version = \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/version = \"$(VERSION)\"/" "$$CARGO_FILE"; \
	\
	# Update package.json \
	if [ -f "$$PACKAGE_FILE" ]; then \
		npm version "$(VERSION)" --no-git-tag-version; \
	fi; \
	\
	# Commit and tag \
	git add -A; \
	git commit -m "bump v$(VERSION)" --no-verify; \
	git tag -s "v$(VERSION)" -m "v$(VERSION)" 2>/dev/null || git tag "v$(VERSION)" -m "v$(VERSION)"; \
	echo "✅ Version bumped to $(VERSION), tagged v$(VERSION)"

release: bump-version  # Bump version and trigger GitHub Actions release
	@git push --no-verify; \
	git push --tags --no-verify; \
	echo ""; \
	echo "🚀 Release v$(VERSION) triggered!"; \
	echo ""; \
	echo "📊 Monitor build progress:"; \
	echo "   gh run list -R $(shell git remote get-url origin | sed 's/.*github\.com[:/]\(.*\)\.git/\1/')"; \
	echo ""; \
	echo "🔗 Release will be available at:"; \
	echo "   https://github.com/$(shell git remote get-url origin | sed 's/.*github\.com[:/]\(.*\)\.git/\1/')/releases"

release-local: clean build sign-local notarize  # Complete local release: build + sign + notarize
	echo "🎉 Local release complete!"

clean:  # Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	cd $(TAURI_DIR) && cargo clean
	rm -rf $(DIST_DIR)
	rm -rf $(TAURI_DIR)/target

# Aliases
run: dev
sign: sign-local
check-sign: sign-verify

# =============================================================================
# CI targets - 用于 GitHub Actions
# =============================================================================

# CI 使用的 macOS 构建目标
# 用法: make ci-build-macos TARGET=aarch64-apple-darwin
CI_TARGET ?= aarch64-apple-darwin
.PHONY: ci-build-macos
ci-build-macos:
	@echo "🔨 CI build for macOS ($(CI_TARGET))..."
	@cd $(TAURI_DIR) && cargo tauri build --target $(CI_TARGET)

# CI 使用的 Linux 构建目标
.PHONY: ci-build-linux
ci-build-linux:
	@echo "🔨 CI build for Linux..."
	@cd $(TAURI_DIR) && cargo tauri build

# 生成 Release Notes（供 GitHub Actions 使用）
# 用法: make ci-release-notes VERSION=0.0.7 MACOS_STATUS=success WINDOWS_STATUS=success LINUX_STATUS=failure
MACOS_STATUS ?= unknown
WINDOWS_STATUS ?= unknown
LINUX_STATUS ?= unknown
VERSION_TAG ?= v0.0.0

.PHONY: ci-release-notes
ci-release-notes:
	@MACOS_EMOJI=$$([ "$(MACOS_STATUS)" = "success" ] && echo "✅" || echo "❌"); \
	WINDOWS_EMOJI=$$([ "$(WINDOWS_STATUS)" = "success" ] && echo "✅" || echo "❌"); \
	LINUX_EMOJI=$$([ "$(LINUX_STATUS)" = "success" ] && echo "✅" || echo "❌"); \
	cat << EOF
	## Pico Export Desktop $(VERSION_TAG)

	### Downloads

	$$MACOS_EMOJI **macOS**
	- Apple Silicon (M1/M2/M3) - .dmg
	- Intel (x64) - .dmg

	$$WINDOWS_EMOJI **Windows** (x64) - .exe

	$$LINUX_EMOJI **Linux** (x64) - .deb

	### Installation

	**macOS:**
	\`\`\`bash
	# Download .dmg, open and drag to Applications
	\`\`\`

	**Windows:**
	\`\`\`powershell
	# Download and run .exe installer
	\`\`\`

	**Linux:**
	\`\`\`bash
	# Download and install .deb
	sudo apt install ./pico-export-desktop_*.deb
	\`\`\`

	---

	*Built with ❤️ using Tauri + React*
	EOF
