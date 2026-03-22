import { CheckCircle, FolderOpen, RefreshCw, ArrowLeft, FileCheck, AlertCircle } from 'lucide-react'
import type { DownloadProgress } from '@/types'

interface DownloadCompleteProps {
  progress: DownloadProgress
  downloadDir: string
  onOpenDirectory: () => void
  onRetryFailed: () => void
  onBackToImport: () => void
}

export function DownloadComplete({
  progress,
  downloadDir,
  onOpenDirectory,
  onRetryFailed,
  onBackToImport,
}: DownloadCompleteProps) {
  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const successRate = progress.totalFiles > 0
    ? ((progress.completedFiles / progress.totalFiles) * 100).toFixed(1)
    : '0'

  const failedFiles = progress.fileProgress.filter((f) => f.status === 'failed')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 成功提示 */}
      <div className="card p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">下载完成</h2>
        <p className="text-gray-500">
          共处理 {progress.totalFiles} 个文件，成功率 {successRate}%
        </p>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{progress.completedFiles}</div>
          <div className="text-sm text-gray-500">成功</div>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">{progress.failedFiles}</div>
          <div className="text-sm text-gray-500">失败</div>
        </div>
        <div className="card p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-primary-600">{formatSize(progress.downloadedSize)}</div>
          <div className="text-sm text-gray-500">已下载</div>
        </div>
      </div>

      {/* 保存位置 */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-3">保存位置</h3>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <FolderOpen className="w-5 h-5 text-gray-500" />
          <code className="flex-1 text-sm text-gray-700 truncate">{downloadDir}</code>
          <button
            onClick={onOpenDirectory}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            打开
          </button>
        </div>
      </div>

      {/* 失败文件列表 */}
      {failedFiles.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">失败文件 ({failedFiles.length})</h3>
            <button
              onClick={onRetryFailed}
              className="btn-primary text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重试失败
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {failedFiles.map((file) => (
              <div
                key={file.taskId}
                className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{file.filename}</p>
                  {file.error && (
                    <p className="text-xs text-red-600 mt-1">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          onClick={onBackToImport}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回导入
        </button>
        <button
          onClick={onOpenDirectory}
          className="btn-primary flex-1"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          打开文件夹
        </button>
      </div>
    </div>
  )
}
