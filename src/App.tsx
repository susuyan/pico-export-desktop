import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type Event } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'

import { Sidebar } from '@/components/Sidebar'
import { TaskImport } from '@/components/TaskImport'
import { TaskPreview } from '@/components/TaskPreview'
import { DownloadProgress as DownloadProgressPanel } from '@/components/DownloadProgress'
import { DownloadComplete } from '@/components/DownloadComplete'
import { SettingsPanel } from '@/components/SettingsPanel'
import { useDownloadStore } from '@/stores/downloadStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { DownloadConfig, DownloadProgress, IpcResponse, CheckpointData } from '@/types'

// Tauri 拖拽事件类型
interface DragDropEvent {
  paths: string[]
  position: { x: number; y: number }
}

type ViewType = 'import' | 'preview' | 'downloading' | 'complete'

function App() {
  const [activeView, setActiveView] = useState<ViewType>('import')
  const [isDragging, setIsDragging] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)

  // 错误处理
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error('[App] Render error:', e.error)
      setRenderError(e.error?.message || String(e.error))
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  // 如果有渲染错误，显示错误信息
  if (renderError) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>⚠️ 渲染错误</h1>
        <pre style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', overflow: 'auto' }}>
          {renderError}
        </pre>
        <button
          onClick={() => { setRenderError(null); window.location.reload() }}
          style={{ marginTop: '20px', padding: '12px 24px', background: '#3b82f6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          刷新页面
        </button>
      </div>
    )
  }

  const {
    config,
    setConfig,
    status,
    setStatus,
    progress,
    setProgress,
    checkpoint,
    setCheckpoint,
    downloadDir,
    setDownloadDir,
    error,
    setError,
    reset,
  } = useDownloadStore()

  const {
    defaultDownloadDir,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useSettingsStore()

  // 监听下载进度事件
  useEffect(() => {
    console.log('[App] Setting up event listeners')

    const unlistenProgress = listen<DownloadProgress>('download:progress', (event) => {
      console.log('[App] Progress event received:', event.payload.overallProgress)
      setProgress(event.payload)
    })

    const unlistenComplete = listen<{ success: boolean; message?: string }>('download:complete', (event) => {
      console.log('[App] Complete event received:', event.payload)
      if (event.payload.success) {
        setStatus('completed')
        setActiveView('complete')
        console.log('[App] State updated: status=completed, activeView=complete')
      } else {
        setStatus('error')
        setError(event.payload.message || '下载失败')
        console.log('[App] Download failed:', event.payload.message)
      }
    })

    const unlistenError = listen<string>('download:error', (event) => {
      console.log('[App] Error event received:', event.payload)
      setStatus('error')
      setError(event.payload)
    })

    // 监听 Tauri 拖拽事件
    const unlistenDragDrop = listen<DragDropEvent>('tauri://drag-drop', (event: Event<DragDropEvent>) => {
      setIsDragging(false) // 移除遮罩
      const paths = event.payload.paths
      const jsonFile = paths.find((p) => p.endsWith('.json'))
      if (jsonFile) {
        loadConfig(jsonFile)
      }
    })

    const unlistenDragOver = listen('tauri://drag-over', () => {
      setIsDragging(true)
    })

    const unlistenDragLeave = listen('tauri://drag-leave', () => {
      setIsDragging(false)
    })

    // 检查是否有未完成的检查点
    checkCheckpoint()

    // 加载默认下载目录（如果已设置）
    if (defaultDownloadDir && !downloadDir) {
      setDownloadDir(defaultDownloadDir)
    }

    return () => {
      unlistenProgress.then((fn) => fn())
      unlistenComplete.then((fn) => fn())
      unlistenError.then((fn) => fn())
      unlistenDragDrop.then((fn) => fn())
      unlistenDragOver.then((fn) => fn())
      unlistenDragLeave.then((fn) => fn())
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
      await loadConfig((jsonFile as any).path)
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

      // 设置初始进度，避免空白页
      const initialProgress: DownloadProgress = {
        totalFiles: config.tasks.length,
        completedFiles: 0,
        failedFiles: 0,
        totalSize: config.total_size,
        downloadedSize: 0,
        currentBatch: {
          batchIndex: 0,
          totalBatches: Math.ceil(config.tasks.length / (config.suggested_strategy?.batch_size || 10)),
          filesInBatch: Math.min(config.tasks.length, config.suggested_strategy?.batch_size || 10),
          completedFiles: 0,
        },
        fileProgress: config.tasks.map((task) => ({
          taskId: task.id,
          filename: task.target.split('/').pop() || task.target,
          status: 'pending',
          progress: 0,
        })),
        overallProgress: 0,
        speed: 0,
        remainingTime: 0,
        status: 'downloading',
      }
      setProgress(initialProgress)

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

  // 打开下载目录
  const handleOpenDirectory = async () => {
    if (downloadDir) {
      try {
        await invoke('open_directory', { path: downloadDir })
      } catch (err) {
        console.error('Failed to open directory:', err)
      }
    }
  }

  const handleNavigate = (view: ViewType) => {
    // 如果正在下载中，不允许切换到其他视图
    if (status === 'downloading' && view !== 'downloading') {
      return
    }
    setActiveView(view)
  }

  return (
    <div
      className="h-screen flex bg-gray-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* 顶部标题栏 */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeView === 'import' && '导入下载任务'}
            {activeView === 'preview' && '确认下载信息'}
            {activeView === 'downloading' && '正在下载'}
            {activeView === 'complete' && '下载完成'}
          </h2>
          {status === 'downloading' && activeView !== 'downloading' && (
            <span className="ml-3 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
              下载中...
            </span>
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto relative">
          {/* 拖拽遮罩 */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-primary-500/20 backdrop-blur-sm flex items-center justify-center m-4 rounded-2xl">
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
          <div className="h-full p-6">
            {(activeView === 'import' || activeView === 'preview' || activeView === 'downloading' || activeView === 'complete') && activeView === 'import' && (
              <TaskImport
                onSelectFile={handleSelectFile}
                checkpoint={checkpoint}
                onResumeCheckpoint={handleResumeCheckpoint}
              />
            )}

            {(activeView === 'preview' || (activeView === 'import' && config)) && config && activeView === 'preview' && (
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

            {activeView === 'complete' && (
              <DownloadComplete
                downloadDir={downloadDir}
                stats={
                  progress
                    ? {
                        totalFiles: progress.totalFiles,
                        completedFiles: progress.completedFiles,
                        failedFiles: progress.failedFiles,
                        totalSize: progress.downloadedSize,
                      }
                    : undefined
                }
                onOpenDirectory={handleOpenDirectory}
                onBackToImport={handleBackToImport}
              />
            )}

            {/* 兜底显示 */}
            {!['import', 'preview', 'downloading', 'complete'].includes(activeView) && (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-gray-500 mb-4">未知视图状态: {activeView}</p>
                <button onClick={handleBackToImport} className="btn-primary">返回首页</button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

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
