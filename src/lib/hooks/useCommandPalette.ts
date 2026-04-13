/**
 * Tiny global store for the ⌘K command palette.
 * Uses a module-level variable + a Set of listeners so any component
 * can open/close/toggle the palette without a React context.
 */

import { useEffect, useState } from 'react'

type Listener = (open: boolean) => void

let _open = false
const _listeners = new Set<Listener>()

function notify(value: boolean) {
  _open = value
  _listeners.forEach((fn) => fn(value))
}

export function openCommandPalette() {
  notify(true)
}

export function closeCommandPalette() {
  notify(false)
}

export function toggleCommandPalette() {
  notify(!_open)
}

/** React hook — returns [isOpen, setOpen] */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(_open)

  useEffect(() => {
    _listeners.add(setIsOpen)
    return () => {
      _listeners.delete(setIsOpen)
    }
  }, [])

  return { isOpen, open: openCommandPalette, close: closeCommandPalette, toggle: toggleCommandPalette }
}
