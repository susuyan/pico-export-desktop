import { useCallback, useEffect } from 'react'
import { X, FolderOpen, RotateCcw, Save } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDownloadStore } from '@/stores/downloadStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const settings = useSettingsStore()
  const { setDownloadDir } = useDownloadStore()

  // 同步设置中的下载目录到下载 store
  useEffect(() => {
    if (settings.defaultDownloadDir) {
      setDownloadDir(settings.defaultDownloadDir)
    }
  }, [settings.defaultDownloadDir, setDownloadDir])

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
