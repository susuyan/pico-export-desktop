// 统一 JSON 配置格式 V2.0

export interface AuthInfo {
  ak: string
  sk: string
  token: string
}

export interface DownloadTask {
  id: string
  source: string
  target: string
  size: number
  checksum?: string
}

export interface BatchStrategy {
  batch_size: number
  concurrent: number
  batch_interval_ms: number
}

export interface DownloadConfig {
  version: string
  export_id: string
  created_at: string
  expires_at: string
  endpoint: string
  bucket: string
  auth: AuthInfo
  tasks: DownloadTask[]
  total_files: number
  total_size: number
  suggested_strategy: BatchStrategy
}

// 应用状态
export type DownloadStatus = 'idle' | 'loading' | 'downloading' | 'paused' | 'completed' | 'error'

export interface BatchInfo {
  batchIndex: number
  totalBatches: number
  filesInBatch: number
  completedFiles: number
}

export interface FileProgress {
  taskId: string
  filename: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress: number
  speed?: number
  error?: string
}

export interface DownloadProgress {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  totalSize: number
  downloadedSize: number
  currentBatch: BatchInfo
  fileProgress: FileProgress[]
  overallProgress: number
  speed: number
  remainingTime: number
  status: DownloadStatus
}

export interface CheckpointData {
  exportId: string
  config: DownloadConfig
  completedTasks: string[]
  failedTasks: string[]
  currentBatchIndex: number
  timestamp: number
}

// IPC 命令
export enum IpcCommand {
  LoadConfig = 'load_config',
  StartDownload = 'start_download',
  PauseDownload = 'pause_download',
  ResumeDownload = 'resume_download',
  CancelDownload = 'cancel_download',
  GetProgress = 'get_progress',
  LoadCheckpoint = 'load_checkpoint',
  ClearCheckpoint = 'clear_checkpoint',
  SelectDirectory = 'select_directory',
  OpenDirectory = 'open_directory',
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
