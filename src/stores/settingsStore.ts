import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AppSettings {
  // 下载设置
  defaultDownloadDir: string
}

interface SettingsState extends AppSettings {
  // 设置操作方法
  setDefaultDownloadDir: (dir: string) => void
  resetSettings: () => void

  // 设置面板状态
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
}

const defaultSettings: AppSettings = {
  defaultDownloadDir: '',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDefaultDownloadDir: (dir) => set({ defaultDownloadDir: dir }),

      resetSettings: () => set(defaultSettings),

      isSettingsOpen: false,
      setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    }),
    {
      name: 'pico-export-settings',
      version: 1,
    }
  )
)
