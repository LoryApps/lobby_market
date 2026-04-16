'use client'

/**
 * KeyboardShortcutsModal
 *
 * A full list of Lobby Market keyboard shortcuts, triggered by pressing `?`
 * anywhere on the page (outside a text input / textarea / contenteditable).
 *
 * Sections:
 *   Global · Navigation · Feed · Topics · Search
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { closeKeyboardShortcuts, useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils/cn'

// ─── Shortcut data ────────────────────────────────────────────────────────────

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  color: string
  items: ShortcutEntry[]
}

const SECTIONS: ShortcutSection[] = [
  {
    title: 'Global',
    color: 'text-gold',
    items: [
      { keys: ['?'], description: 'Show this shortcuts panel' },
      { keys: ['⌘K', 'Ctrl+K'], description: 'Open command palette' },
      { keys: ['Esc'], description: 'Close any open modal or palette' },
    ],
  },
  {
    title: 'Navigation',
    color: 'text-for-400',
    items: [
      { keys: ['G', 'H'], description: 'Go to Home feed' },
      { keys: ['G', 'S'], description: 'Go to Search' },
      { keys: ['G', 'F'], description: 'Go to The Floor' },
      { keys: ['G', 'L'], description: 'Go to Law Codex' },
      { keys: ['G', 'D'], description: 'Go to Debates' },
      { keys: ['G', 'P'], description: 'Go to your Profile' },
      { keys: ['G', 'A'], description: 'Go to Analytics' },
      { keys: ['G', 'C'], description: 'Go to Civic Compass' },
    ],
  },
  {
    title: 'Feed',
    color: 'text-purple',
    items: [
      { keys: ['←', '→'], description: 'Swipe to vote For / Against (touch)' },
      { keys: ['J'], description: 'Next topic in feed' },
      { keys: ['K'], description: 'Previous topic in feed' },
    ],
  },
  {
    title: 'Topic / Debate',
    color: 'text-emerald',
    items: [
      { keys: ['F'], description: 'Vote For on focused topic' },
      { keys: ['A'], description: 'Vote Against on focused topic' },
      { keys: ['B'], description: 'Toggle bookmark' },
      { keys: ['S'], description: 'Share current page' },
    ],
  },
  {
    title: 'Search',
    color: 'text-against-400',
    items: [
      { keys: ['/'], description: 'Focus search input' },
      { keys: ['↑', '↓'], description: 'Navigate results' },
      { keys: ['↵'], description: 'Open selected result' },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[24px] h-6 px-1.5',
        'rounded-md bg-surface-300 border border-surface-400',
        'text-[11px] font-mono font-medium text-surface-700',
        'shadow-[0_1px_0_0_rgba(0,0,0,0.5)]'
      )}
    >
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, description }: ShortcutEntry) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-surface-600 font-mono">{description}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[10px] text-surface-600 font-mono">or</span>
            )}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal() {
  const { isOpen } = useKeyboardShortcuts()

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') closeKeyboardShortcuts()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [isOpen])

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          {/* Backdrop */}
          <motion.div
            key="ks-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeKeyboardShortcuts}
          />

          {/* Panel */}
          <motion.div
            key="ks-panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 w-full max-w-lg max-h-[85dvh]',
              'rounded-2xl bg-surface-100 border border-surface-300',
              'shadow-2xl shadow-black/60 flex flex-col overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                  <Keyboard className="h-4 w-4 text-gold" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-mono font-bold text-white">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Press <Kbd>?</Kbd> to show / hide
                  </p>
                </div>
              </div>
              <button
                onClick={closeKeyboardShortcuts}
                aria-label="Close shortcuts panel"
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg',
                  'text-surface-500 hover:text-white',
                  'hover:bg-surface-300 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3
                    className={cn(
                      'text-[10px] font-mono font-bold uppercase tracking-widest mb-1',
                      section.color
                    )}
                  >
                    {section.title}
                  </h3>
                  <div className="divide-y divide-surface-300/50">
                    {section.items.map((item) => (
                      <ShortcutRow key={item.description} {...item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-surface-300 bg-surface-200/50">
              <p className="text-[11px] font-mono text-surface-600 text-center">
                Navigation shortcuts use sequential key chords — press keys one after another
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── Provider (registers the ? global hotkey) ─────────────────────────────────

export function KeyboardShortcutsProvider() {
  const { close } = useKeyboardShortcuts()

  useEffect(() => {
    // Chord state for "G + X" navigation shortcuts
    let chordKey: string | null = null
    let chordTimer: ReturnType<typeof setTimeout> | null = null

    function clearChord() {
      chordKey = null
      if (chordTimer) {
        clearTimeout(chordTimer)
        chordTimer = null
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement

      // Ignore shortcuts when typing in inputs / textareas / contenteditable
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="textbox"]') !== null

      if (isEditing) {
        clearChord()
        return
      }

      // Ignore if any modifier key is held (except Shift for ? key)
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey
      if (hasModifier) return

      const key = e.key

      // ── ? — toggle the shortcuts panel ────────────────────────────────────
      if (key === '?') {
        e.preventDefault()
        import('@/lib/hooks/useKeyboardShortcuts').then(({ toggleKeyboardShortcuts }) => {
          toggleKeyboardShortcuts()
        })
        clearChord()
        return
      }

      // ── Escape — close shortcuts panel (handled in modal, but also here) ──
      if (key === 'Escape') {
        close()
        clearChord()
        return
      }

      // ── G + X navigation chords ────────────────────────────────────────────
      if (chordKey === 'g') {
        clearChord()
        const navMap: Record<string, string> = {
          h: '/',
          s: '/search',
          f: '/floor',
          l: '/law',
          d: '/debate',
          p: '/profile/me',
          a: '/analytics',
        }
        const dest = navMap[key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          window.location.href = dest
        }
        return
      }

      if (key.toLowerCase() === 'g') {
        chordKey = 'g'
        // Clear chord after 1.5 seconds if no second key pressed
        chordTimer = setTimeout(clearChord, 1500)
        return
      }

      clearChord()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearChord()
    }
  }, [close])

  return <Modal />
}
