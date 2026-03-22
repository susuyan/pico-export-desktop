import { Pause, Play, Square, Clock, Zap, FileCheck, AlertCircle } from 'lucide-react'
import type { DownloadProgress as ProgressType, DownloadStatus } from '@/types'

interface DownloadProgressProps {
  progress: ProgressType | null
  status: DownloadStatus
  onPauseResume: () => void
  onCancel: () => void
}

export function DownloadProgress({ progress, status, onPauseResume, onCancel }: DownloadProgressProps) {
  if (!progress) return null

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '-'
    return formatSize(bytesPerSecond) + '/s'
  }

  const formatTime = (seconds: number) => {
    if (seconds === 0) return '-'
    if (seconds < 60) return `${Math.ceil(seconds)} 秒`
    if (seconds < 3600) return `${Math.ceil(seconds / 60)} 分钟`
    return `${Math.floor(seconds / 3600)} 小时 ${Math.ceil((seconds % 3600) / 60)} 分钟`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 总体进度 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">下载进度</h3>
          <div className="flex gap-2">
            <button
              onClick={onPauseResume}
              className="btn-secondary"
            >
              {status === 'downloading' ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  暂停
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  继续
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              className="btn-danger"
            >
              <Square className="w-4 h-4 mr-2" />
              取消
            </button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 animate-progress"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {progress.completedFiles} / {progress.totalFiles} 个文件
          </span>
          <span className="font-medium text-primary-600">
            {progress.overallProgress.toFixed(1)}%
          </span>
        </div>

        {/* 统计信息 */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs">下载速度</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSpeed(progress.speed)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">剩余时间</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {formatTime(progress.remainingTime)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FileCheck className="w-4 h-4" />
              <span className="text-xs">已下载</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSize(progress.downloadedSize)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">失败</span>
            </div>
            <div className={`text-lg font-semibold ${progress.failedFiles > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {progress.failedFiles} 个
            </div>
          </div>
        </div>
      </div>

      {/* 当前批次 */}
      <div className="card p-6">
        <h4 className="font-semibold text-gray-900 mb-4">
          当前批次: {progress.currentBatch.batchIndex + 1} / {progress.currentBatch.totalBatches}
        </h4>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary-400 rounded-full transition-all duration-300"
            style={{
              width: `${(progress.currentBatch.completedFiles / progress.currentBatch.filesInBatch) * 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {progress.currentBatch.completedFiles} / {progress.currentBatch.filesInBatch} 个文件
        </p>
      </div>

      {/* 文件列表 */}
      <div className="card p-6">
        <h4 className="font-semibold text-gray-900 mb-4">文件进度</h4>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {progress.fileProgress.slice(0, 20).map((file) => (
            <div
              key={file.taskId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 w-5 h-5">
                {file.status === 'completed' && (
                  <FileCheck className="w-5 h-5 text-green-500" />
                )}
                {file.status === 'downloading' && (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
                {file.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                {file.status === 'failed' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.filename}
                </p>
                {file.status === 'downloading' && (
                  <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-sm text-gray-500">
                {file.status === 'downloading' && file.speed && `${formatSpeed(file.speed)}`}
                {file.status === 'completed' && '完成'}
                {file.status === 'failed' && '失败'}
              </div>
            </div>
          ))}
          {progress.fileProgress.length > 20 && (
            <p className="text-center text-sm text-gray-500 py-2">
              还有 {progress.fileProgress.length - 20} 个文件...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
