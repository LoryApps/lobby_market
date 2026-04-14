/**
 * Tiny global store for the keyboard shortcuts modal.
 * Same pattern as useCommandPalette — module-level variable + listener set.
 */

import { useEffect, useState } from 'react'

type Listener = (open: boolean) => void

let _open = false
const _listeners = new Set<Listener>()

function notify(value: boolean) {
  _open = value
  _listeners.forEach((fn) => fn(value))
}

export function openKeyboardShortcuts() {
  notify(true)
}

export function closeKeyboardShortcuts() {
  notify(false)
}

export function toggleKeyboardShortcuts() {
  notify(!_open)
}

export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(_open)

  useEffect(() => {
    _listeners.add(setIsOpen)
    return () => {
      _listeners.delete(setIsOpen)
    }
  }, [])

  return {
    isOpen,
    open: openKeyboardShortcuts,
    close: closeKeyboardShortcuts,
    toggle: toggleKeyboardShortcuts,
  }
}
