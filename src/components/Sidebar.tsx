import { useState } from 'react'
import {
  Download,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type ViewType = 'import' | 'preview' | 'downloading' | 'complete'

interface SidebarProps {
  activeView: ViewType
  onNavigate: (view: ViewType) => void
  onOpenSettings: () => void
}

interface NavItem {
  id: ViewType
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

export function Sidebar({ activeView, onNavigate, onOpenSettings }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const mainNavItems: NavItem[] = [
    {
      id: 'import',
      label: '新建下载',
      icon: <Plus className="w-5 h-5" />,
    },
  ]

  const isActive = (id: ViewType) => {
    if (id === 'import') {
      return ['import', 'preview', 'downloading', 'complete'].includes(activeView)
    }
    return activeView === id
  }

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo区域 */}
      <div className="h-16 border-b border-gray-200 flex items-center px-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-sm font-bold text-gray-900 truncate">Pico Export</h1>
            <p className="text-[10px] text-gray-500 truncate">桌面下载工具</p>
          </div>
        )}
      </div>

      {/* 主导航 */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {mainNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            disabled={item.disabled}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.id)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* 底部操作区 */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          title={collapsed ? '设置' : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>设置</span>}
        </button>

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors mt-2"
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  )
}
