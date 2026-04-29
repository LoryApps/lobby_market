'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        setError(authError.message)
        return
      }
      router.push('/')
      router.refresh()
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-surface-500 mt-1.5 text-sm">
          Log in to continue shaping consensus
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

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-for-400/80 hover:text-for-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'w-full rounded-xl border bg-surface-200 pl-10 pr-10 py-2.5 text-sm text-white',
                'placeholder-surface-500 border-surface-300',
                'focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500/40',
                'transition-colors',
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
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
              aria-label="Logging in"
            />
          ) : (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          )}
          {isLoading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold text-for-400 hover:text-for-300 transition-colors"
        >
          Join the Lobby
        </Link>
      </p>
    </motion.div>
  )
}
