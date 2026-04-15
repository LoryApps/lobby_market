'use client'

/**
 * useFocusTrap
 *
 * Traps keyboard focus within a container element while it is active.
 * When `active` is true:
 *   - Focus is moved into the container on mount
 *   - Tab / Shift+Tab cycle within the container's focusable children
 *   - Focus is restored to the previously-focused element on deactivation
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null)
 *   useFocusTrap(ref, isOpen)
 *
 * The ref must point to the wrapper element that contains all focusable
 * children. Pass the same boolean that controls visibility so the trap
 * activates and releases at the right time.
 */

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest('[aria-hidden="true"]')
  )
}

export function useFocusTrap(
  ref: React.RefObject<HTMLElement>,
  active: boolean,
  /** If true, focus is moved into the container as soon as active becomes true */
  autoFocus = true
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !ref.current) return

    // Store the element that had focus before the trap activated
    previouslyFocusedRef.current = document.activeElement as HTMLElement

    // Move focus into the container
    if (autoFocus) {
      const focusable = getFocusableElements(ref.current)
      const firstFocusable = focusable[0]
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        // If no focusable children, focus the container itself
        ref.current.setAttribute('tabindex', '-1')
        ref.current.focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !ref.current) return

      const focusable = getFocusableElements(ref.current)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement

      if (e.shiftKey) {
        // Shift+Tab: if we're at the first element, wrap to last
        if (active === first || !ref.current.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if we're at the last element, wrap to first
        if (active === last || !ref.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      // Restore focus to the previously focused element
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus()
      }
    }
  }, [active, autoFocus, ref])
}
