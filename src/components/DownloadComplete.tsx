import { CheckCircle, FolderOpen, Plus, FileDown, FileCheck, AlertCircle, Zap } from 'lucide-react'

interface DownloadStats {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  totalSize: number
  downloadTime?: string
}

interface DownloadCompleteProps {
  downloadDir: string
  stats?: DownloadStats
  onOpenDirectory: () => void
  onBackToImport: () => void
}

function formatSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
}

export function DownloadComplete({
  downloadDir,
  stats,
  onOpenDirectory,
  onBackToImport,
}: DownloadCompleteProps) {
  const displayDir = downloadDir || '未知位置'
  const hasFailures = stats && stats.failedFiles > 0

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* 成功提示 */}
      <div className={`card p-10 text-center ${hasFailures ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'}`}>
        <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center ${hasFailures ? 'bg-amber-100' : 'bg-green-100'}`}>
          {hasFailures ? (
            <AlertCircle className="w-10 h-10 text-amber-600" />
          ) : (
            <CheckCircle className="w-10 h-10 text-green-600" />
          )}
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${hasFailures ? 'text-amber-800' : 'text-green-800'}`}>
          {hasFailures ? '下载完成（部分失败）' : '下载完成！'}
        </h2>
        <p className="text-gray-600">
          {hasFailures
            ? `${stats?.completedFiles} 个文件下载成功，${stats?.failedFiles} 个文件下载失败`
            : '所有文件已成功下载到指定目录'}
        </p>
      </div>

      {/* 下载统计 */}
      {stats && (
        <div className="card p-6 mt-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            下载统计
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <FileCheck className="w-4 h-4" />
                <span className="text-xs">成功</span>
              </div>
              <div className="text-xl font-semibold text-green-600">
                {stats.completedFiles}
              </div>
              <div className="text-xs text-gray-400">个文件</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">失败</span>
              </div>
              <div className={`text-xl font-semibold ${stats.failedFiles > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {stats.failedFiles}
              </div>
              <div className="text-xs text-gray-400">个文件</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <FileDown className="w-4 h-4" />
                <span className="text-xs">总大小</span>
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {formatSize(stats.totalSize)}
              </div>
              <div className="text-xs text-gray-400">{stats.totalFiles} 个文件</div>
            </div>
          </div>
        </div>
      )}

      {/* 保存位置 */}
      <div className="card p-6 mt-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          保存位置
        </h3>
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <code className="flex-1 text-sm text-gray-700 truncate font-mono">{displayDir}</code>
          <button
            onClick={onOpenDirectory}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-primary-300 transition-colors flex items-center gap-2 shrink-0"
          >
            <FolderOpen className="w-4 h-4" />
            打开
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={onBackToImport}
          className="btn-secondary flex-1 py-3 text-base"
        >
          <Plus className="w-5 h-5 mr-2" />
          添加新任务
        </button>
        <button
          onClick={onOpenDirectory}
          className="btn-primary flex-1 py-3 text-base"
        >
          <FolderOpen className="w-5 h-5 mr-2" />
          打开下载目录
        </button>
      </div>

      {/* 提示信息 */}
      <p className="text-center text-sm text-gray-500 mt-6">
        您可以关闭此窗口或继续添加新的下载任务
      </p>
    </div>
  )
}
