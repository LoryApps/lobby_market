'use client'

import { ReactNode, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ToastProvider } from '@/components/ui/Toaster'
import { NotificationWatcher } from '@/components/ui/NotificationWatcher'
import { AchievementWatcher } from '@/components/ui/AchievementWatcher'
import { useCommandPalette, toggleCommandPalette } from '@/lib/hooks/useCommandPalette'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { RouteProgressBar } from '@/components/layout/RouteProgressBar'
import { useAuthStore } from '@/lib/stores/auth-store'

// Initialize auth store once at the app level so all components can
// synchronously check whether the current visitor is logged in.
function AuthInitializer() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => { init() }, [init])
  return null
}

// Register the service worker for Web Push Notifications
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[sw] registration failed:', err))
  }, [])
  return null
}

// Lazy-load heavy modal components — they're only needed when the user
// triggers them, so they should not bloat the initial JS bundle.
const CommandPalette = dynamic(
  () => import('@/components/ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false }
)

const KeyboardShortcutsProvider = dynamic(
  () => import('@/components/ui/KeyboardShortcutsModal').then((m) => m.KeyboardShortcutsProvider),
  { ssr: false }
)

interface ProvidersProps {
  children: ReactNode
}

// Mounts the palette and registers the global ⌘K / Ctrl+K shortcut.
function CommandPaletteProvider() {
  const { isOpen, close } = useCommandPalette()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K (Mac) or Ctrl+K (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Allow the shortcut even when a text input is focused so users can
        // quickly open the palette from the TopBar's inline search field.
        e.preventDefault()
        toggleCommandPalette()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <CommandPalette open={isOpen} onClose={close} />
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ToastProvider>
      <AuthInitializer />
      <ServiceWorkerRegistrar />
      <RouteProgressBar />
      {children}
      <NotificationWatcher />
      <AchievementWatcher />
      <CommandPaletteProvider />
      <KeyboardShortcutsProvider />
      <InstallPrompt />
    </ToastProvider>
  )
}
