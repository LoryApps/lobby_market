'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { LobbyPosition, Topic } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

const NAME_MAX = 80
const STATEMENT_MAX = 500
const MAX_EVIDENCE_LINKS = 8

function CreateLobbyPageInner() {
  const router = useRouter()
  const search = useSearchParams()
  const initialTopicId = search.get('topic_id') ?? ''

  const [topics, setTopics] = useState<
    Pick<Topic, 'id' | 'statement' | 'status'>[]
  >([])
  const [topicId, setTopicId] = useState(initialTopicId)
  const [name, setName] = useState('')
  const [position, setPosition] = useState<LobbyPosition>('for')
  const [statement, setStatement] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [pendingLink, setPendingLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('topics')
      .select('id, statement, status')
      .in('status', ['proposed', 'active', 'voting', 'continued'])
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data }) => {
        setTopics(
          (data as Pick<Topic, 'id' | 'statement' | 'status'>[] | null) ?? []
        )
      })
  }, [])

  const addEvidence = () => {
    const link = pendingLink.trim()
    if (!link) return
    if (evidence.length >= MAX_EVIDENCE_LINKS) {
      setError(`Max ${MAX_EVIDENCE_LINKS} evidence links`)
      return
    }
    setEvidence((prev) => [...prev, link])
    setPendingLink('')
  }

  const removeEvidence = (idx: number) => {
    setEvidence((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topicId) {
      setError('Select a topic')
      return
    }
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!statement.trim()) {
      setError('Campaign statement is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          name: name.trim(),
          position,
          campaign_statement: statement.trim(),
          evidence_links: evidence,
        }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to create lobby')
      }
      const data = await res.json()
      router.push(`/lobby/${data.lobby.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gold" />
            Start a Lobby
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
              Topic
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className={cn(
                'w-full rounded-xl px-4 py-3 font-mono text-sm appearance-none',
                'bg-surface-200 border border-surface-300 text-white',
                'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
              )}
            >
              <option value="">Select a topic…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.status.toUpperCase()}] {t.statement.slice(0, 80)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
              Position
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPosition('for')}
                className={cn(
                  'rounded-xl border px-4 py-3 font-mono text-sm font-semibold transition-colors',
                  position === 'for'
                    ? 'bg-for-500/10 border-for-500/50 text-for-400'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                )}
              >
                FOR
              </button>
              <button
                type="button"
                onClick={() => setPosition('against')}
                className={cn(
                  'rounded-xl border px-4 py-3 font-mono text-sm font-semibold transition-colors',
                  position === 'against'
                    ? 'bg-against-500/10 border-against-500/50 text-against-400'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                )}
              >
                AGAINST
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
              Lobby Name
            </label>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Workers United"
              className={cn(
                'w-full rounded-xl px-4 py-3 font-mono text-sm',
                'bg-surface-200 border border-surface-300 text-white',
                'placeholder:text-surface-500',
                'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
              )}
            />
            <div className="text-right text-[11px] font-mono text-surface-500">
              {name.length}/{NAME_MAX}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
              Campaign Statement
            </label>
            <textarea
              value={statement}
              maxLength={STATEMENT_MAX}
              onChange={(e) => setStatement(e.target.value)}
              rows={6}
              placeholder="Make the case for your position. Be specific and substantive."
              className={cn(
                'w-full rounded-xl px-4 py-3 font-mono text-sm resize-y',
                'bg-surface-200 border border-surface-300 text-white',
                'placeholder:text-surface-500',
                'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
              )}
            />
            <div className="text-right text-[11px] font-mono text-surface-500">
              {statement.length}/{STATEMENT_MAX}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
              Evidence Links (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                value={pendingLink}
                onChange={(e) => setPendingLink(e.target.value)}
                placeholder="https://example.com/source"
                className={cn(
                  'flex-1 rounded-xl px-4 py-3 font-mono text-xs',
                  'bg-surface-200 border border-surface-300 text-white',
                  'placeholder:text-surface-500',
                  'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
                )}
              />
              <Button
                type="button"
                variant="gold"
                size="md"
                onClick={addEvidence}
                disabled={!pendingLink.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {evidence.length > 0 && (
              <div className="space-y-2">
                {evidence.map((link, idx) => (
                  <div
                    key={`${link}-${idx}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 font-mono text-xs"
                  >
                    <LinkIcon className="h-3 w-3 text-surface-500 flex-shrink-0" />
                    <span className="flex-1 truncate text-surface-700">
                      {link}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(idx)}
                      className="text-surface-500 hover:text-against-400"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            size="lg"
            className="w-full"
            disabled={
              submitting || !topicId || !name.trim() || !statement.trim()
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Megaphone className="h-4 w-4" />
                Launch Lobby
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function CreateLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-50">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      }
    >
      <CreateLobbyPageInner />
    </Suspense>
  )
}
