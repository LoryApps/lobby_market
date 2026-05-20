'use client'

import { useCallback, useEffect, useState } from 'react'

export type PushState =
  | 'unsupported'
  | 'loading'
  | 'not_subscribed'
  | 'subscribed'
  | 'blocked'
  | 'error'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  // Check current state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        setSubscription(sub)
        setState('subscribed')
      } else {
        setState('not_subscribed')
      }
    }).catch(() => setState('error'))
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return false
    }
    try {
      setState('loading')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      setSubscription(sub)

      // Save subscription to server
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(json),
      })

      setState('subscribed')
      return true
    } catch (err) {
      console.error('[push] subscribe failed:', err)
      if (Notification.permission === 'denied') {
        setState('blocked')
      } else {
        setState('error')
      }
      return false
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setState('loading')
      if (subscription) {
        // Notify server first, then unsubscribe browser-side
        await fetch('/api/push/unsubscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setSubscription(null)
      setState('not_subscribed')
      return true
    } catch (err) {
      console.error('[push] unsubscribe failed:', err)
      setState('error')
      return false
    }
  }, [subscription])

  return { state, subscription, subscribe, unsubscribe }
}
