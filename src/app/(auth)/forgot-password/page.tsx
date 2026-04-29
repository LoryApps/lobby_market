'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/profile/settings`,
        },
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-surface-100 border border-surface-300/80 rounded-2xl p-8 shadow-2xl shadow-black/60"
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-center py-4"
          >
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-emerald/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald" aria-hidden="true" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-surface-500 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
              We&apos;ve sent a password reset link to{' '}
              <span className="text-surface-700 font-medium">{email}</span>. It
              expires in 24 hours.
            </p>
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold',
                'bg-surface-200 text-white hover:bg-surface-300 transition-colors',
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to login
            </Link>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">Reset password</h1>
              <p className="text-surface-500 mt-1.5 text-sm">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      'w-full rounded-xl border bg-surface-200 pl-10 pr-4 py-2.5 text-sm text-white',
                      'placeholder-surface-500 border-surface-300',
                      'focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500/40',
                      'transition-colors',
                    )}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-against-950 border border-against-800/60 px-4 py-3 text-sm text-against-400"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'mt-2 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                  'text-sm font-semibold text-white',
                  'bg-for-500 hover:bg-for-600 active:bg-for-700',
                  'focus:outline-none focus:ring-2 focus:ring-for-500 focus:ring-offset-2 focus:ring-offset-surface-100',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all duration-150',
                )}
              >
                {isLoading ? (
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                    aria-label="Sending reset link"
                  />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {isLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            {/* Footer */}
            <p className="mt-6 text-center text-sm text-surface-500">
              Remembered it?{' '}
              <Link
                href="/login"
                className="font-semibold text-for-400 hover:text-for-300 transition-colors"
              >
                Back to login
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
