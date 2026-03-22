import { Download, History, Settings, HelpCircle } from 'lucide-react'

interface HeaderProps {
  activeView: string
  onNavigate: (view: 'import' | 'preview' | 'downloading' | 'complete') => void
}

export function Header({ activeView, onNavigate }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Pico Export Desktop</h1>
            <p className="text-xs text-gray-500">跨平台数据下载工具</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <button
            onClick={() => onNavigate('import')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'import'
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            导入任务
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            历史记录
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            帮助
          </button>
        </nav>
      </div>
    </header>
  )
}
