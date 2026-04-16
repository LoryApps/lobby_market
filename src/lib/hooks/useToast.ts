'use client'

import { createContext, useContext } from 'react'

export type ToastVariant = 'achievement' | 'success' | 'error' | 'info'
export type ToastTier = 'common' | 'rare' | 'epic' | 'legendary'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  body?: string
  icon?: string
  tier?: ToastTier
  /** ms before auto-dismiss; default 5000 */
  duration?: number
  /** Optional URL shown as a "Share" CTA on achievement toasts */
  link?: string
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
