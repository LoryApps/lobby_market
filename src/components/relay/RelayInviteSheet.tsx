'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, GitMerge, Loader2, Send } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils/cn'

interface RelayInviteSheetProps {
  relayId: string
  relayTopicStatement?: string
  isFor: boolean
  open: boolean
  onClose: () => void
}

export function RelayInviteSheet({
  relayId,
  relayTopicStatement,
  isFor,
  open,
  onClose,
}: RelayInviteSheetProps) {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  const accentClass = isFor ? 'text-for-400' : 'text-against-400'
  const borderFocusClass = isFor
    ? 'focus:border-for-600/60 focus:ring-for-600/20'
    : 'focus:border-against-600/60 focus:ring-against-600/20'

  const handleSend = useCallback(async () => {
    const trimmed = username.trim().replace(/^@/, '')
    if (!trimmed) {
      setError('Enter a username')
      usernameRef.current?.focus()
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relayId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmed,
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to send invitation')
        return
      }
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setUsername('')
        setMessage('')
        onClose()
      }, 1500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }, [relayId, username, message, onClose])

  function handleClose() {
    if (sending) return
    setUsername('')
    setMessage('')
    setError(null)
    setSent(false)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Invite a collaborator">
      <div className="px-4 pb-6 space-y-4">
        {/* Context header */}
        <div className={cn(
          'flex items-start gap-3 rounded-xl border p-3',
          isFor
            ? 'border-for-500/20 bg-for-500/5'
            : 'border-against-500/20 bg-against-500/5'
        )}>
          <GitMerge className={cn('h-4 w-4 mt-0.5 flex-shrink-0', accentClass)} aria-hidden="true" />
          <div className="min-w-0">
            <p className={cn('text-xs font-mono font-semibold', accentClass)}>
              {isFor ? 'FOR' : 'AGAINST'} relay
            </p>
            {relayTopicStatement && (
              <p className="text-xs text-surface-500 mt-0.5 leading-snug line-clamp-2">
                {relayTopicStatement}
              </p>
            )}
          </div>
        </div>

        {/* Username field */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-username"
            className="block text-xs font-mono text-surface-400 font-medium"
          >
            Who do you want to invite?
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm font-mono select-none"
              aria-hidden="true"
            >
              @
            </span>
            <input
              id="invite-username"
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.replace(/^@/, ''))
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
              placeholder="username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={sending || sent}
              className={cn(
                'w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm font-mono',
                'bg-surface-100/80 text-white placeholder:text-surface-600',
                'focus:outline-none focus:ring-1 transition-colors',
                'disabled:opacity-60',
                error
                  ? 'border-against-600/60 focus:border-against-600 focus:ring-against-600/20'
                  : `border-surface-400/30 ${borderFocusClass}`
              )}
            />
          </div>
          {error && (
            <p className="text-xs font-mono text-against-400" role="alert">{error}</p>
          )}
        </div>

        {/* Optional message */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-message"
            className="block text-xs font-mono text-surface-400 font-medium"
          >
            Personal note <span className="text-surface-600">(optional)</span>
          </label>
          <textarea
            id="invite-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 280))}
            placeholder="Tell them why you want their take…"
            rows={3}
            disabled={sending || sent}
            className={cn(
              'w-full px-3 py-2.5 rounded-xl border text-sm font-mono resize-none',
              'bg-surface-100/80 text-white placeholder:text-surface-600',
              'focus:outline-none focus:ring-1 transition-colors',
              `border-surface-400/30 ${borderFocusClass}`,
              'disabled:opacity-60'
            )}
          />
          <p className="text-[11px] font-mono text-surface-600 text-right">
            {message.length}/280
          </p>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || sent || !username.trim()}
          aria-label="Send relay invitation"
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
            'text-sm font-mono font-semibold transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            sent
              ? 'bg-emerald/20 text-emerald border border-emerald/30'
              : isFor
                ? 'bg-for-600 hover:bg-for-500 text-white border border-for-500/50'
                : 'bg-against-600 hover:bg-against-500 text-white border border-against-500/50'
          )}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : sent ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {sent ? 'Invitation sent!' : 'Send invitation'}
        </button>

        <p className="text-[11px] font-mono text-surface-600 text-center leading-snug">
          They&apos;ll receive a notification and can join the relay directly from it.
        </p>
      </div>
    </BottomSheet>
  )
}
