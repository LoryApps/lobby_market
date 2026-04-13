'use client'

import { ReactNode, useEffect } from 'react'
import { ToastProvider } from '@/components/ui/Toaster'
import { NotificationWatcher } from '@/components/ui/NotificationWatcher'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useCommandPalette, toggleCommandPalette } from '@/lib/hooks/useCommandPalette'

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
      {children}
      <NotificationWatcher />
      <CommandPaletteProvider />
    </ToastProvider>
  )
}
