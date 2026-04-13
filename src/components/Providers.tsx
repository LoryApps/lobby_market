'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toaster'
import { NotificationWatcher } from '@/components/ui/NotificationWatcher'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      {children}
      <NotificationWatcher />
    </ToastProvider>
  )
}
