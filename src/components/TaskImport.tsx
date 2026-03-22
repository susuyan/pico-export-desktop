import { Upload, FileJson, Play, Clock, CheckCircle2 } from 'lucide-react'
import type { CheckpointData } from '@/types'

interface TaskImportProps {
  onSelectFile: () => void
  checkpoint: CheckpointData | null
  onResumeCheckpoint: () => void
}

export function TaskImport({ onSelectFile, checkpoint, onResumeCheckpoint }: TaskImportProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 主导入区域 */}
      <div
        onClick={onSelectFile}
        className="card p-12 text-center cursor-pointer transition-all hover:shadow-md hover:border-primary-300 group"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
          <Upload className="w-10 h-10 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          拖拽 JSON 配置文件到这里
        </h2>
        <p className="text-gray-500 mb-6">或点击选择文件</p>
        <button className="btn-primary">
          <FileJson className="w-4 h-4 mr-2" />
          选择配置文件
        </button>
      </div>

      {/* 断点续传提示 */}
      {checkpoint && (
        <div className="card p-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">发现未完成任务</h3>
              <p className="text-sm text-amber-700 mt-1">
                配置文件: {checkpoint.exportId}
              </p>
              <p className="text-sm text-amber-700">
                上次进度: {checkpoint.completedTasks.length} / {checkpoint.config.tasks.length} 个文件
              </p>
              <p className="text-sm text-amber-700">
                上次时间: {formatTime(checkpoint.timestamp)}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={onResumeCheckpoint}
                  className="btn-primary bg-amber-600 hover:bg-amber-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  继续下载
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">使用步骤</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-700">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">在 Pico 平台导出数据</p>
              <p className="text-sm text-gray-500">
                登录 Pico 采集平台，选择需要下载的任务，点击"导出数据"生成配置文件
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-700">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">导入配置文件</p>
              <p className="text-sm text-gray-500">
                将下载的 JSON 配置文件拖拽到此处，或点击选择文件
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-700">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">开始下载</p>
              <p className="text-sm text-gray-500">
                选择保存目录，点击开始下载。支持断点续传和后台运行
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 特性介绍 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-gray-900">智能分批</p>
          <p className="text-xs text-gray-500 mt-1">自动优化大批量下载</p>
        </div>
        <div className="card p-4 text-center">
          <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="font-medium text-gray-900">断点续传</p>
          <p className="text-xs text-gray-500 mt-1">中断后可继续下载</p>
        </div>
        <div className="card p-4 text-center">
          <Upload className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="font-medium text-gray-900">后台运行</p>
          <p className="text-xs text-gray-500 mt-1">最小化到系统托盘</p>
        </div>
      </div>
    </div>
  )
}
