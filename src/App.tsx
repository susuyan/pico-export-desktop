import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/api/dialog'
import { appWindow } from '@tauri-apps/api/window'

import { Header } from '@/components/Header'
import { TaskImport } from '@/components/TaskImport'
import { TaskPreview } from '@/components/TaskPreview'
import { DownloadProgress as DownloadProgressPanel } from '@/components/DownloadProgress'
import { DownloadComplete } from '@/components/DownloadComplete'
import { useDownloadStore } from '@/stores/downloadStore'
import type { DownloadConfig, DownloadProgress, IpcResponse } from '@/types'

function App() {
  const [activeView, setActiveView] = useState<'import' | 'preview' | 'downloading' | 'complete'>('import')
  const [isDragging, setIsDragging] = useState(false)

  const {
    config,
    setConfig,
    status,
    setStatus,
    progress,
    setProgress,
    updateProgress,
    checkpoint,
    setCheckpoint,
    downloadDir,
    setDownloadDir,
    error,
    setError,
    reset,
  } = useDownloadStore()

  // 监听下载进度事件
  useEffect(() => {
    const unlistenProgress = listen<DownloadProgress>('download:progress', (event) => {
      setProgress(event.payload)
    })

    const unlistenComplete = listen<{ success: boolean; message?: string }>('download:complete', (event) => {
      if (event.payload.success) {
        setStatus('completed')
        setActiveView('complete')
      } else {
        setStatus('error')
        setError(event.payload.message || '下载失败')
      }
    })

    const unlistenError = listen<string>('download:error', (event) => {
      setStatus('error')
      setError(event.payload)
    })

    // 检查是否有未完成的检查点
    checkCheckpoint()

    return () => {
      unlistenProgress.then((fn) => fn())
      unlistenComplete.then((fn) => fn())
      unlistenError.then((fn) => fn())
    }
  }, [])

  // 检查检查点
  const checkCheckpoint = async () => {
    try {
      const response = await invoke<IpcResponse>('load_checkpoint')
      if (response.success && response.data) {
        setCheckpoint(response.data as CheckpointData)
      }
    } catch (err) {
      console.log('No checkpoint found')
    }
  }

  // 处理文件拖拽
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const jsonFile = files.find((f) => f.name.endsWith('.json'))

    if (jsonFile) {
      await loadConfig(jsonFile.path)
    }
  }, [])

  // 加载配置文件
  const loadConfig = async (path: string) => {
    try {
      setStatus('loading')
      const response = await invoke<IpcResponse>('load_config', { path })

      if (response.success && response.data) {
        setConfig(response.data as DownloadConfig)
        setActiveView('preview')
      } else {
        setError(response.error || '加载配置失败')
        setStatus('error')
      }
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }

  // 选择文件
  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (selected && typeof selected === 'string') {
      await loadConfig(selected)
    }
  }

  // 选择下载目录
  const handleSelectDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (selected && typeof selected === 'string') {
      setDownloadDir(selected)
    }
  }

  // 开始下载
  const handleStartDownload = async () => {
    if (!config || !downloadDir) return

    try {
      setStatus('downloading')
      setActiveView('downloading')

      await invoke('start_download', {
        config,
        downloadDir,
      })
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }

  // 暂停/继续下载
  const handlePauseResume = async () => {
    if (status === 'downloading') {
      await invoke('pause_download')
      setStatus('paused')
    } else if (status === 'paused') {
      await invoke('resume_download')
      setStatus('downloading')
    }
  }

  // 取消下载
  const handleCancel = async () => {
    await invoke('cancel_download')
    setStatus('idle')
    setActiveView('import')
    reset()
  }

  // 继续检查点的下载
  const handleResumeCheckpoint = async () => {
    if (checkpoint) {
      setConfig(checkpoint.config)
      setActiveView('preview')
    }
  }

  // 返回导入页面
  const handleBackToImport = () => {
    setActiveView('import')
    reset()
  }

  return (
    <div
      className="h-screen flex flex-col bg-gray-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header activeView={activeView} onNavigate={setActiveView} />

      <main className="flex-1 overflow-hidden relative">
        {/* 拖拽遮罩 */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-primary-500/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">释放以导入配置</h3>
              <p className="mt-2 text-gray-500">支持 .json 格式的配置文件</p>
            </div>
          </div>
        )}

        {/* 视图切换 */}
        <div className="h-full overflow-auto p-6">
          {activeView === 'import' && (
            <TaskImport
              onSelectFile={handleSelectFile}
              checkpoint={checkpoint}
              onResumeCheckpoint={handleResumeCheckpoint}
            />
          )}

          {activeView === 'preview' && config && (
            <TaskPreview
              config={config}
              downloadDir={downloadDir}
              onSelectDirectory={handleSelectDirectory}
              onStartDownload={handleStartDownload}
              onBack={handleBackToImport}
            />
          )}

          {activeView === 'downloading' && (
            <DownloadProgressPanel
              progress={progress}
              status={status}
              onPauseResume={handlePauseResume}
              onCancel={handleCancel}
            />
          )}

          {activeView === 'complete' && progress && (
            <DownloadComplete
              progress={progress}
              downloadDir={downloadDir}
              onOpenDirectory={() => invoke('open_directory', { path: downloadDir })}
              onRetryFailed={() => {
                setStatus('downloading')
                setActiveView('downloading')
                invoke('retry_failed')
              }}
              onBackToImport={handleBackToImport}
            />
          )}
        </div>
      </main>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-md bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-red-800">出错了</h4>
              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
