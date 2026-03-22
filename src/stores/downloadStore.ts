import { create } from 'zustand'
import type { DownloadConfig, DownloadProgress, DownloadStatus, CheckpointData } from '@/types'

interface DownloadState {
  // 配置
  config: DownloadConfig | null
  setConfig: (config: DownloadConfig) => void
  clearConfig: () => void

  // 状态
  status: DownloadStatus
  setStatus: (status: DownloadStatus) => void

  // 进度
  progress: DownloadProgress | null
  setProgress: (progress: DownloadProgress) => void
  updateProgress: (updates: Partial<DownloadProgress>) => void

  // 检查点
  checkpoint: CheckpointData | null
  setCheckpoint: (checkpoint: CheckpointData | null) => void

  // 下载目录
  downloadDir: string
  setDownloadDir: (dir: string) => void

  // 错误信息
  error: string | null
  setError: (error: string | null) => void

  // 重置
  reset: () => void
}

const initialProgress: DownloadProgress = {
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  totalSize: 0,
  downloadedSize: 0,
  currentBatch: {
    batchIndex: 0,
    totalBatches: 0,
    filesInBatch: 0,
    completedFiles: 0,
  },
  fileProgress: [],
  overallProgress: 0,
  speed: 0,
  remainingTime: 0,
  status: 'idle',
}

export const useDownloadStore = create<DownloadState>((set) => ({
  config: null,
  setConfig: (config) => set({ config, status: 'loading' }),
  clearConfig: () => set({ config: null, status: 'idle', progress: null }),

  status: 'idle',
  setStatus: (status) => set({ status }),

  progress: null,
  setProgress: (progress) => set({ progress }),
  updateProgress: (updates) =>
    set((state) => ({
      progress: state.progress ? { ...state.progress, ...updates } : null,
    })),

  checkpoint: null,
  setCheckpoint: (checkpoint) => set({ checkpoint }),

  downloadDir: '',
  setDownloadDir: (dir) => set({ downloadDir: dir }),

  error: null,
  setError: (error) => set({ error }),

  reset: () =>
    set({
      config: null,
      status: 'idle',
      progress: null,
      checkpoint: null,
      error: null,
    }),
}))
