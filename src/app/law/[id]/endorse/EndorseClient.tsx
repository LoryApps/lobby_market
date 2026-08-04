'use client'

/**
 * /law/[id]/endorse — Formal Law Endorsement
 *
 * Citizens can formally endorse an established law — a standing affirmation
 * that they support this law and want it to remain. Distinct from:
 *   The original FOR vote   — created the law
 *   Verdict votes           — retrospective: succeeded / failed?
 *   Reopen petitions        — request to re-debate the law
 *   Formal challenges       — procedural / constitutional objections
 *
 * An endorsement is a live public statement: "I stand behind this law."
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Gavel,
  Heart,
  HeartOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawEndorseData,
  EndorsementItem,
} from '@/app/api/laws/[id]/endorse/route'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EndorseSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 items-start p-4 rounded-xl bg-surface-800">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Endorsement card ─────────────────────────────────────────────────────────

interface EndorsementCardProps {
  item: EndorsementItem
  isCurrentUser: boolean
  onRemove: () => void
}

function EndorsementCard({ item, isCurrentUser, onRemove }: EndorsementCardProps) {
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    onRemove()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'flex gap-3 items-start p-4 rounded-xl border transition-colors',
        isCurrentUser
          ? 'bg-for-500/10 border-for-500/30'
          : 'bg-surface-800 border-surface-700',
      )}
    >
      <Avatar
        src={item.author?.avatar_url ?? null}
        username={item.author?.username ?? 'u'}
        size={36}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${item.author?.username ?? ''}`}
            className="font-medium text-surface-100 hover:text-for-300 transition-colors text-sm"
          >
            {item.author?.display_name ?? item.author?.username ?? 'Anonymous'}
          </Link>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs text-for-300 border-for-500/40 bg-for-500/10 py-0">
              You
            </Badge>
          )}
          {(item.author?.clout ?? 0) >= 500 && (
            <Badge variant="outline" className="text-xs text-gold border-gold/40 bg-gold/10 py-0">
              <Award className="w-3 h-3 mr-1" />
              Trusted
            </Badge>
          )}
          <span className="text-surface-500 text-xs ml-auto">
            {new Date(item.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        {item.message && (
          <p className="mt-1 text-sm text-surface-300 leading-relaxed">{item.message}</p>
        )}
      </div>
      {isCurrentUser && (
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove endorsement"
          className="text-surface-500 hover:text-against-400 transition-colors flex-shrink-0"
        >
          {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      )}
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function EndorseClient({ lawId }: Props) {
  const [data, setData] = useState<LawEndorseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [showMessageInput, setShowMessageInput] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/endorse`)
      if (!res.ok) throw new Error('Failed to load endorsements')
      const json: LawEndorseData = await res.json()
      setData(json)
    } catch {
      setError('Could not load endorsements. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleEndorse() {
    if (!userId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/endorse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setError('You have already endorsed this law.')
          return
        }
        throw new Error(err.error ?? 'Failed to endorse')
      }
      const newEndorsement: EndorsementItem = await res.json()
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          endorsement_count: prev.endorsement_count + 1,
          endorsements: [newEndorsement, ...prev.endorsements],
          user_endorsement: newEndorsement,
        }
      })
      setMessage('')
      setShowMessageInput(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to endorse')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveEndorsement() {
    if (!userId || !data?.user_endorsement) return
    const endorsementId = data.user_endorsement.id
    try {
      const res = await fetch(`/api/laws/${lawId}/endorse`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove endorsement')
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          endorsement_count: Math.max(0, prev.endorsement_count - 1),
          endorsements: prev.endorsements.filter((e) => e.id !== endorsementId),
          user_endorsement: null,
        }
      })
    } catch {
      setError('Failed to remove endorsement. Please try again.')
    }
  }

  const hasEndorsed = !!data?.user_endorsement

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Back link */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-surface-400 hover:text-surface-100 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Law
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-for-500/15 border border-for-500/30">
            <Heart className="w-5 h-5 text-for-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-100">Endorsements</h1>
            <p className="text-sm text-surface-400">Citizens who formally stand behind this law</p>
          </div>
        </div>

        {loading && <EndorseSkeleton />}

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-against-500/10 border border-against-500/30 mb-4">
            <span className="text-against-300 text-sm flex-1">{error}</span>
            <button
              onClick={() => { setError(null); fetchData() }}
              className="text-against-300 hover:text-against-200 flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Law statement */}
            <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 mb-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-surface-700 flex-shrink-0">
                  <Gavel className="w-4 h-4 text-surface-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-surface-100 font-medium text-sm leading-snug line-clamp-3">
                    {data.law_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {data.law_category && (
                      <Badge variant="outline" className="text-xs text-surface-400 border-surface-600">
                        {data.law_category}
                      </Badge>
                    )}
                    <span className="text-xs text-surface-500">
                      {Math.round(data.law_blue_pct ?? 50)}% FOR · {(data.law_total_votes ?? 0).toLocaleString()} votes
                    </span>
                    {data.law_established_at && (
                      <span className="text-xs text-surface-500">
                        Established{' '}
                        {new Date(data.law_established_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Endorsement count */}
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-for-300" />
              <span className="text-surface-300 text-sm font-medium">
                {data.endorsement_count === 0
                  ? 'No endorsements yet'
                  : `${data.endorsement_count.toLocaleString()} endorser${data.endorsement_count === 1 ? '' : 's'}`}
              </span>
            </div>

            {/* Endorse / Remove CTA */}
            {!userId ? (
              <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 mb-6 text-center">
                <p className="text-surface-400 text-sm mb-3">Sign in to endorse this law</p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500 hover:bg-for-400 text-white text-sm font-medium transition-colors"
                >
                  Sign in
                </Link>
              </div>
            ) : hasEndorsed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-xl bg-for-500/15 border border-for-500/40 mb-6 flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-for-300 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-for-200 font-medium text-sm">You endorse this law</p>
                  <p className="text-for-400/70 text-xs mt-0.5">
                    Your support is publicly visible
                  </p>
                </div>
                <button
                  onClick={handleRemoveEndorsement}
                  className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-against-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-against-500/10 border border-transparent hover:border-against-500/30"
                >
                  <HeartOff className="w-3.5 h-3.5" />
                  Remove
                </button>
              </motion.div>
            ) : (
              <div className="rounded-xl bg-surface-800 border border-surface-700 mb-6 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-surface-200 font-medium text-sm">Add your endorsement</p>
                    <button
                      onClick={() => setShowMessageInput((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {showMessageInput ? 'Hide message' : 'Add a message'}
                    </button>
                  </div>
                  <AnimatePresence>
                    {showMessageInput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          ref={textareaRef}
                          value={message}
                          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                          placeholder="Why do you endorse this law? (optional, ≤280 chars)"
                          rows={3}
                          className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-surface-100 placeholder-surface-500 resize-none focus:outline-none focus:border-for-500 transition-colors mb-2"
                        />
                        <p className="text-xs text-surface-500 text-right mb-3">
                          {message.length}/280
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={handleEndorse}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-for-500 hover:bg-for-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        Endorse this law
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Endorsements list */}
            {data.endorsements.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No endorsements yet"
                description="Be the first to formally stand behind this law."
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {data.endorsements.map((item) => (
                    <EndorsementCard
                      key={item.id}
                      item={item}
                      isCurrentUser={item.user_id === userId}
                      onRemove={handleRemoveEndorsement}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
