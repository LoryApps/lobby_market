'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, UserRound, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

// ── Password strength ──────────────────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: 'bg-against-500' }
  if (score <= 3) return { score, label: 'Fair', color: 'bg-gold' }
  return { score, label: 'Strong', color: 'bg-emerald' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const usernameError =
    username.length > 0 && !USERNAME_REGEX.test(username)
      ? '3–20 characters: letters, numbers, underscores'
      : null

  const strength = useMemo(() => getStrength(password), [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!USERNAME_REGEX.test(username)) {
      setError('Username must be 3–20 characters: letters, numbers, and underscores only.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setMessage('Account created! Check your email to confirm, then come back to log in.')
      router.push('/onboarding')
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
        <h1 className="text-2xl font-bold text-white">Join the Lobby</h1>
        <p className="text-surface-500 mt-1.5 text-sm">
          Create your account and start shaping consensus
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        {/* Username */}
        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider"
          >
            Username
          </label>
          <div className="relative">
            <UserRound
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                'w-full rounded-xl border bg-surface-200 pl-10 pr-4 py-2.5 text-sm text-white',
                'placeholder-surface-500',
                usernameError
                  ? 'border-against-500/60 focus:border-against-500'
                  : 'border-surface-300 focus:border-for-500',
                'focus:outline-none focus:ring-1',
                usernameError ? 'focus:ring-against-500/30' : 'focus:ring-for-500/40',
                'transition-colors',
              )}
              placeholder="cool_username"
              aria-describedby={usernameError ? 'username-error' : undefined}
            />
          </div>
          {usernameError && (
            <p id="username-error" className="text-xs text-against-400 pl-1">
              {usernameError}
            </p>
          )}
        </div>

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

        {/* Password + strength */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider"
          >
            Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'w-full rounded-xl border bg-surface-200 pl-10 pr-10 py-2.5 text-sm text-white',
                'placeholder-surface-500 border-surface-300',
                'focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500/40',
                'transition-colors',
              )}
              placeholder="At least 6 characters"
              aria-describedby="password-strength"
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

          {/* Strength meter */}
          {password.length > 0 && (
            <div id="password-strength" aria-live="polite">
              <div className="flex gap-1 mt-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-200',
                      i < strength.score ? strength.color : 'bg-surface-300',
                    )}
                  />
                ))}
              </div>
              {strength.label && (
                <p
                  className={cn(
                    'text-xs mt-1 pl-0.5',
                    strength.score <= 1
                      ? 'text-against-400'
                      : strength.score <= 3
                        ? 'text-gold'
                        : 'text-emerald',
                  )}
                >
                  {strength.label} password
                </p>
              )}
            </div>
          )}
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

        {/* Success */}
        {message && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald/10 border border-emerald/30 px-4 py-3 text-sm text-emerald"
          >
            {message}
          </motion.div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !!usernameError}
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
              aria-label="Creating account"
            />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {isLoading ? 'Creating account…' : 'Create Account'}
        </button>

        {/* Terms note */}
        <p className="text-center text-[11px] text-surface-500 leading-relaxed">
          By joining you agree to our{' '}
          <Link href="/guidelines" className="text-surface-600 hover:text-surface-700 underline underline-offset-2">
            community guidelines
          </Link>
          .
        </p>
      </form>

      {/* Footer */}
      <p className="mt-5 text-center text-sm text-surface-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-for-400 hover:text-for-300 transition-colors"
        >
          Log in
        </Link>
      </p>
    </motion.div>
  )
}
