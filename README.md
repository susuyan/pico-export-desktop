# Pico Export Desktop

Pico 采集平台跨平台数据下载工具

## 功能特性

- **跨平台支持**: macOS (Intel/Apple Silicon), Windows, Linux
- **智能分批下载**: 自动根据文件数量优化下载策略
- **断点续传**: 中断后可从上次进度继续
- **图形化界面**: 直观易用的拖拽操作
- **实时进度**: 显示下载速度、剩余时间、批次进度
- **后台运行**: 最小化到系统托盘

## 快速开始

### 安装

1. 从 [Releases](https://github.com/susuyan/pico-export-desktop/releases) 下载对应平台的安装包
2. 安装并运行应用

### 使用

1. 在 Pico 平台导出数据，下载 JSON 配置文件
2. 将 JSON 文件拖拽到应用窗口
3. 选择保存目录，点击开始下载
4. 等待下载完成

## 开发

### 环境要求

- Node.js 18+
- Rust 1.70+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri:dev
```

### 构建

```bash
npm run tauri:build
```

## 项目结构

```
pico-export-desktop/
├── src/                    # React 前端
│   ├── components/         # 组件
│   ├── stores/            # 状态管理
│   ├── types/             # TypeScript 类型
│   └── App.tsx            # 主应用
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── main.rs        # 入口
│   │   ├── config.rs      # 配置解析
│   │   ├── downloader.rs  # 下载管理
│   │   ├── scheduler.rs   # 任务调度
│   │   └── checkpoint.rs  # 断点续存
│   └── Cargo.toml
└── package.json
```

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Zustand
- **后端**: Rust + Tokio + Tauri
- **存储**: Sled (嵌入式 KV 存储)

## 许可证

MIT
