'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toaster'
import { AchievementWatcher } from '@/components/ui/AchievementWatcher'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      {children}
      <AchievementWatcher />
    </ToastProvider>
  )
}
