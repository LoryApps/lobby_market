'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  userEmail: string | null
}

type State = 'idle' | 'loading' | 'success' | 'error' | 'not_found'

export function UnsubscribeClient({ userEmail }: Props) {
  const [email, setEmail] = useState(userEmail ?? '')
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json()

      if (!res.ok) {
        setErrorMsg(json.error ?? 'Something went wrong.')
        setState('error')
        return
      }

      // found === false means email wasn't in the list (or already unsubscribed)
      if (json.found === false) {
        setState('not_found')
      } else {
        setState('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 flex flex-col items-center gap-8">
      {/* Back link */}
      <Link
        href="/newsletter"
        className="self-start flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to newsletter
      </Link>

      <AnimatePresence mode="wait">
        {state === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-50 mb-2">You&apos;re unsubscribed</h1>
              <p className="text-surface-400 text-sm leading-relaxed">
                <span className="text-surface-200">{email}</span> has been removed from The Civic
                Brief. You won&apos;t receive any more emails from us.
              </p>
            </div>
            <p className="text-xs text-surface-500">Changed your mind?</p>
            <Link
              href="/newsletter"
              className="px-5 py-2.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-medium transition-colors"
            >
              Re-subscribe
            </Link>
          </motion.div>
        ) : state === 'not_found' ? (
          <motion.div
            key="not_found"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center">
              <Mail className="w-8 h-8 text-surface-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-50 mb-2">Not subscribed</h1>
              <p className="text-surface-400 text-sm leading-relaxed">
                <span className="text-surface-200">{email}</span> isn&apos;t on our list — or
                you&apos;ve already unsubscribed.
              </p>
            </div>
            <Link
              href="/newsletter"
              className="text-sm text-for-400 hover:text-for-300 transition-colors"
            >
              Go back to newsletter
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col gap-6"
          >
            {/* Header */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-against-900/40 border border-against-700/30 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-against-400" />
              </div>
              <h1 className="text-2xl font-bold text-surface-50 mb-2">Unsubscribe</h1>
              <p className="text-surface-400 text-sm">
                Enter your email to unsubscribe from The Civic Brief.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-surface-400 uppercase tracking-wider">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    'w-full px-4 py-3 rounded-lg bg-surface-900 border text-surface-100',
                    'placeholder:text-surface-600 text-sm outline-none transition-colors',
                    'focus:border-surface-500 focus:ring-1 focus:ring-surface-500/30',
                    state === 'error'
                      ? 'border-against-600'
                      : 'border-surface-700'
                  )}
                  disabled={state === 'loading'}
                />
              </div>

              <AnimatePresence>
                {state === 'error' && errorMsg && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-against-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all',
                  'bg-against-700 hover:bg-against-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {state === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Unsubscribing…
                  </>
                ) : (
                  'Unsubscribe'
                )}
              </button>
            </form>

            <p className="text-center text-xs text-surface-600">
              We&apos;ll immediately remove your email from all future sends.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
