import { FolderOpen, Play, ArrowLeft, FileArchive, Clock, Zap } from 'lucide-react'
import type { DownloadConfig } from '@/types'

interface TaskPreviewProps {
  config: DownloadConfig
  downloadDir: string
  onSelectDirectory: () => void
  onStartDownload: () => void
  onBack: () => void
}

export function TaskPreview({
  config,
  downloadDir,
  onSelectDirectory,
  onStartDownload,
  onBack,
}: TaskPreviewProps) {
  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRemainingMinutes = (expiresAt: string) => {
    const expires = new Date(expiresAt).getTime()
    const remaining = Math.ceil((expires - Date.now()) / 60000)
    return remaining > 0 ? remaining : 0
  }

  const estimateTime = (totalSize: number) => {
    // 假设平均下载速度 10MB/s
    const speed = 10 * 1024 * 1024 // 10 MB/s
    const seconds = totalSize / speed
    if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`
    if (seconds < 3600) return `约 ${Math.ceil(seconds / 60)} 分钟`
    return `约 ${Math.floor(seconds / 3600)} 小时 ${Math.ceil((seconds % 3600) / 60)} 分钟`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">任务预览</h2>
      </div>

      {/* 导出概览 */}
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileArchive className="w-6 h-6 text-primary-600" />
            <span className="font-semibold text-primary-900">导出概览</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-white text-sm text-primary-700 border border-primary-200">
            <Clock className="w-3 h-3 inline mr-1" />
            有效期至 {formatTime(config.expires_at)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/70 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-700">{config.total_files}</div>
            <div className="text-sm text-primary-600">文件数</div>
          </div>
          <div className="bg-white/70 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-700">{formatSize(config.total_size)}</div>
            <div className="text-sm text-primary-600">总大小</div>
          </div>
          <div className="bg-white/70 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-700">{getRemainingMinutes(config.expires_at)}</div>
            <div className="text-sm text-primary-600">剩余分钟</div>
          </div>
        </div>
      </div>

      {/* 下载策略 */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          智能下载策略
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">批次大小</p>
            <p className="text-lg font-semibold text-gray-900">
              {config.suggested_strategy.batch_size} 个文件/批
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">并发数</p>
            <p className="text-lg font-semibold text-gray-900">
              {config.suggested_strategy.concurrent} 个并发
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">批次间隔</p>
            <p className="text-lg font-semibold text-gray-900">
              {config.suggested_strategy.batch_interval_ms / 1000} 秒
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          预估下载时间: {estimateTime(config.total_size)}
        </p>
      </div>

      {/* 选择保存目录 */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">保存位置</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={downloadDir}
            placeholder="请选择下载保存目录"
            readOnly
            className="input flex-1"
          />
          <button
            onClick={onSelectDirectory}
            className="btn-secondary whitespace-nowrap"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            选择目录
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="btn-secondary flex-1"
        >
          返回
        </button>
        <button
          onClick={onStartDownload}
          disabled={!downloadDir}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 mr-2" />
          开始下载
        </button>
      </div>

      {/* 注意事项 */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-800 mb-2">注意事项</h4>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• 配置文件包含临时凭证，有效期 1 小时，过期后需重新导出</li>
          <li>• 请勿将配置文件分享给他人</li>
          <li>• 支持断点续传：中断后重新导入配置即可继续</li>
          <li>• 大规模下载会自动分批处理，请保持网络连接稳定</li>
        </ul>
      </div>
    </div>
  )
}
