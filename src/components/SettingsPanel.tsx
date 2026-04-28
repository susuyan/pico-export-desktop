import { useCallback, useEffect, useState } from 'react'
import { X, FolderOpen, RotateCcw, Save, Download, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDownloadStore } from '@/stores/downloadStore'

interface ObsutilStatus {
  installed: boolean
  install_dir: string
  download_url: string
  platform: string
}

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const settings = useSettingsStore()
  const { setDownloadDir } = useDownloadStore()
  const [obsutilStatus, setObsutilStatus] = useState<ObsutilStatus | null>(null)

  // 同步设置中的下载目录到下载 store
  useEffect(() => {
    if (settings.defaultDownloadDir) {
      setDownloadDir(settings.defaultDownloadDir)
    }
  }, [settings.defaultDownloadDir, setDownloadDir])

  // 检查 obsutil 安装状态
  useEffect(() => {
    if (isOpen) {
      invoke<IpcResponse<ObsutilStatus>>('check_obsutil_status')
        .then((res) => {
          if (res.success && res.data) {
            setObsutilStatus(res.data)
          }
        })
        .catch((err) => {
          console.error('Failed to check obsutil status:', err)
        })
    }
  }, [isOpen])

  const handleSelectDownloadDir = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: settings.defaultDownloadDir || undefined,
    })

    if (selected && typeof selected === 'string') {
      settings.setDefaultDownloadDir(selected)
      setDownloadDir(selected)
    }
  }, [settings, setDownloadDir])

  const handleOpenInstallDir = useCallback(async () => {
    if (obsutilStatus?.install_dir) {
      await invoke('open_directory', { path: obsutilStatus.install_dir })
    }
  }, [obsutilStatus])

  const handleOpenDownloadUrl = useCallback(() => {
    if (obsutilStatus?.download_url) {
      // 在新窗口打开下载链接
      window.open(obsutilStatus.download_url, '_blank')
    }
  }, [obsutilStatus])

  const handleReset = () => {
    if (confirm('确定要重置所有设置为默认值吗？')) {
      settings.resetSettings()
    }
  }

  const handleSave = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">设置</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 命令行工具 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              命令行工具 (obsutil)
            </h3>

            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              {/* 安装状态 */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {obsutilStatus?.installed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    {obsutilStatus?.installed ? '已安装' : '未安装'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    平台: {obsutilStatus?.platform || '检测中...'}
                  </div>
                </div>
              </div>

              {/* 安装目录 */}
              {obsutilStatus && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    安装目录
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={obsutilStatus.install_dir}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
                    />
                    <button
                      onClick={handleOpenInstallDir}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      打开
                    </button>
                  </div>
                </div>
              )}

              {/* 安装指引 */}
              {!obsutilStatus?.installed && obsutilStatus?.download_url && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    安装步骤：
                  </div>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>点击下方按钮下载 obsutil 压缩包</li>
                    <li>解压后将 obsutil 可执行文件放入上述安装目录</li>
                    <li>macOS 用户需执行: <code className="bg-blue-100 px-1 rounded">chmod +x obsutil</code></li>
                    <li>重启应用即可使用</li>
                  </ol>
                  <button
                    onClick={handleOpenDownloadUrl}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>下载 obsutil</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* 已安装提示 */}
              {obsutilStatus?.installed && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-sm text-green-800">
                    ✓ obsutil 已正确安装，应用可以正常使用
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 下载设置 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              下载设置
            </h3>

            <div className="space-y-4">
              {/* 默认下载目录 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  默认下载目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultDownloadDir || '未设置'}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
                  />
                  <button
                    onClick={handleSelectDownloadDir}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    选择
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  新任务将默认保存到此目录
                </p>
              </div>
            </div>
          </section>

          {/* 关于 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              关于
            </h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Pico Export Desktop - 跨平台数据下载工具
              </p>
              <p className="text-xs text-gray-400 mt-1">
                版本 1.0.0 | 使用 OBS 官方工具 obsutil 进行高速下载
              </p>
            </div>
          </section>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置为默认
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
