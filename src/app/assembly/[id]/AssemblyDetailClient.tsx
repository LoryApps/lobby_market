'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AssemblyDetailResponse, DeliberationPost } from '@/app/api/assemblies/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const STATUS_CONFIG = {
  forming:      { label: 'Forming',      color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/30' },
  deliberating: { label: 'Deliberating', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  concluded:    { label: 'Concluded',    color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
} as const

const STANCE_OPTIONS = [
  { key: 'strong_for',     label: 'Strongly For',    color: 'text-for-400' },
  { key: 'lean_for',       label: 'Leaning For',     color: 'text-for-300' },
  { key: 'divided',        label: 'Divided',         color: 'text-gold' },
  { key: 'lean_against',   label: 'Leaning Against', color: 'text-against-300' },
  { key: 'strong_against', label: 'Strongly Against', color: 'text-against-400' },
]

// ─── Deliberation Post ────────────────────────────────────────────────────────

function DeliberationCard({ post, roundLabel }: { post: DeliberationPost; roundLabel?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-4 rounded-xl border transition-all',
        post.is_chair
          ? 'bg-purple/5 border-purple/20'
          : 'bg-surface-100 border-surface-300'
      )}
    >
      <Avatar
        src={post.author?.avatar_url ?? null}
        fallback={post.author?.display_name || post.author?.username || '?'}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Link
            href={`/profile/${post.author?.username ?? ''}`}
            className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            @{post.author?.username ?? 'unknown'}
          </Link>
          {post.is_chair && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple/20 text-purple border border-purple/30">
              <Gavel className="h-2.5 w-2.5" /> CHAIR
            </span>
          )}
          {roundLabel && (
            <span className="text-[10px] font-mono text-surface-600 bg-surface-200 border border-surface-300 px-1.5 py-0.5 rounded">
              Round {post.round_number}
            </span>
          )}
          <span className="text-[10px] text-surface-600 ml-auto">{relativeTime(post.created_at)}</span>
        </div>
        <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Post Form ────────────────────────────────────────────────────────────────

function DeliberationForm({
  assemblyId,
  roundNumber,
  onPosted,
}: {
  assemblyId: string
  roundNumber: number
  onPosted: () => void
}) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const charOk = content.trim().length >= 20 && content.length <= 1000

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!charOk) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/assemblies/${assemblyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deliberate', content: content.trim(), round_number: roundNumber }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to post')
        return
      }
      setContent('')
      onPosted()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 1000))}
        rows={4}
        placeholder="Share your deliberation — engage with other members' arguments, introduce new evidence, or update your position…"
        className={cn(
          'w-full px-3 py-2.5 rounded-xl bg-surface-200 border text-sm text-white',
          'placeholder:text-surface-500 leading-relaxed resize-none',
          'focus:outline-none focus:ring-1 transition-colors',
          content.length > 0 && !charOk
            ? 'border-against-500/40 focus:border-against-500/60 focus:ring-against-500/20'
            : 'border-surface-300 focus:border-purple/50 focus:ring-purple/20'
        )}
      />
      <div className="flex items-center justify-between gap-3">
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-against-400">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <span className={cn(
          'ml-auto text-xs font-mono',
          content.length > 1000 ? 'text-against-400' : content.trim().length >= 20 ? 'text-emerald' : 'text-surface-600'
        )}>
          {content.length}/1000
        </span>
        <Button type="submit" size="sm" disabled={submitting || !charOk}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Post
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Conclude Form (chair only) ───────────────────────────────────────────────

function ConcludeForm({
  assemblyId,
  onConcluded,
}: {
  assemblyId: string
  onConcluded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [recommendation, setRecommendation] = useState('')
  const [stance, setStance] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (recommendation.trim().length < 50) { setError('Recommendation must be at least 50 characters'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/assemblies/${assemblyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'conclude', recommendation: recommendation.trim(), stance }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to conclude')
        return
      }
      onConcluded()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
        <Gavel className="h-3.5 w-3.5" />
        Submit Recommendation
      </Button>
    )
  }

  return (
    <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Gavel className="h-4 w-4 text-gold" />
        <span className="text-xs font-mono font-semibold text-gold">Assembly Recommendation</span>
      </div>

      <div>
        <label className="block text-xs font-mono text-surface-600 mb-1.5">Collective stance</label>
        <div className="flex flex-wrap gap-2">
          {STANCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStance(opt.key)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-mono transition-all border',
                stance === opt.key
                  ? `${opt.color} bg-surface-200 border-current`
                  : 'text-surface-500 bg-surface-200 border-surface-300 hover:border-surface-400'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value.slice(0, 2000))}
          rows={5}
          placeholder="Write the assembly's collective recommendation. Summarise the deliberation, state the collective position, and explain the key reasons the assembly reached this conclusion…"
          className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder:text-surface-500 leading-relaxed resize-none focus:outline-none focus:border-gold/50"
        />
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-against-400">{error}</span>}
          <span className="ml-auto text-xs font-mono text-surface-600">{recommendation.length}/2000</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" variant="gold" size="sm" disabled={submitting || recommendation.trim().length < 50}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Conclude Assembly'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AssemblyDetailClient() {
  const { id } = useParams<{ id: string }>()
  const [assembly, setAssembly] = useState<AssemblyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [joining, setJoining] = useState(false)

  const fetchAssembly = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`/api/assemblies/${id}`)
      if (!res.ok) return
      const data = (await res.json()) as AssemblyDetailResponse
      setAssembly(data)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { fetchAssembly() }, [fetchAssembly])

  async function handleJoin() {
    setJoining(true)
    try {
      const res = await fetch('/api/assemblies/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assembly_id: id }),
      })
      if (res.ok) fetchAssembly(true)
    } catch { /* ignore */ }
    finally { setJoining(false) }
  }

  async function handleReact(reaction: 'endorse' | 'question' | 'object') {
    await fetch('/api/assemblies/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assembly_id: id, reaction }),
    })
    fetchAssembly(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
          <Skeleton className="h-5 w-32 mb-6" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!assembly) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-3xl mb-4">⚖️</p>
          <h1 className="text-lg font-mono font-bold text-white mb-2">Assembly not found</h1>
          <Link href="/assembly" className="text-sm text-surface-500 hover:text-white transition-colors">
            Back to assemblies
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[assembly.status]
  const canJoin = assembly.status === 'forming' && !assembly.user_is_member
  const memberFill = assembly.members.length / assembly.max_members

  // Group deliberations by round
  const roundMap = new Map<number, DeliberationPost[]>()
  for (const d of assembly.deliberations) {
    const r = d.round_number
    if (!roundMap.has(r)) roundMap.set(r, [])
    roundMap.get(r)!.push(d)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-5">

        {/* Back */}
        <Link
          href="/assembly"
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All assemblies
        </Link>

        {/* Assembly header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              statusCfg.color, statusCfg.bg, statusCfg.border
            )}>
              {statusCfg.label}
            </span>
            {assembly.topic_category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-300 text-surface-500 border border-surface-400/30">
                {assembly.topic_category}
              </span>
            )}
            {assembly.user_is_member && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple/10 text-purple border border-purple/30">
                <Users className="h-2.5 w-2.5" /> Member
              </span>
            )}
            <button
              onClick={() => fetchAssembly(true)}
              disabled={refreshing}
              className="ml-auto p-1 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>

          <h1 className="text-lg font-mono font-bold text-white mb-2">{assembly.title}</h1>

          <div className="p-3 rounded-xl bg-surface-200 border border-surface-300 mb-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
              <p className="text-sm text-surface-600 leading-relaxed">{assembly.question}</p>
            </div>
          </div>

          {assembly.topic_statement && (
            <Link
              href={`/topic/${assembly.topic_id}`}
              className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors mb-4"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {assembly.topic_statement}
            </Link>
          )}

          {/* Member roster */}
          <div className="border-t border-surface-300 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-surface-600">
                Members ({assembly.members.length}/{assembly.max_members})
              </span>
              <div className="h-1.5 w-32 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    assembly.status === 'concluded' ? 'bg-emerald' :
                    assembly.status === 'deliberating' ? 'bg-for-500' : 'bg-gold'
                  )}
                  style={{ width: `${Math.min(memberFill * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {assembly.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/profile/${m.profile?.username ?? ''}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
                >
                  <Avatar
                    src={m.profile?.avatar_url ?? null}
                    fallback={m.profile?.display_name || m.profile?.username || '?'}
                    size="xs"
                    className={m.is_chair ? 'ring-1 ring-gold' : ''}
                  />
                  <span className="text-[11px] font-mono text-surface-600">
                    @{m.profile?.username ?? '?'}
                  </span>
                  {m.is_chair && (
                    <Gavel className="h-2.5 w-2.5 text-gold" />
                  )}
                </Link>
              ))}
              {assembly.members.length < assembly.max_members && (
                Array.from({ length: assembly.max_members - assembly.members.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/50 border border-dashed border-surface-400/40"
                  >
                    <div className="w-5 h-5 rounded-full bg-surface-300/50" />
                    <span className="text-[11px] font-mono text-surface-600">Open seat</span>
                  </div>
                ))
              )}
            </div>

            {canJoin && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="for"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full"
                >
                  {joining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      Join this Assembly
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-surface-600 mt-1.5">
                  Volunteers enter a random selection — join the pool to be considered
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Concluded: recommendation */}
        {assembly.status === 'concluded' && assembly.recommendation && (
          <div className="rounded-2xl bg-emerald/5 border border-emerald/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald" />
              <span className="text-sm font-mono font-bold text-emerald">Assembly Recommendation</span>
              {assembly.stance && (
                <span className={cn(
                  'ml-auto text-xs font-mono font-bold',
                  STANCE_OPTIONS.find(o => o.key === assembly.stance)?.color ?? 'text-surface-500'
                )}>
                  {STANCE_OPTIONS.find(o => o.key === assembly.stance)?.label}
                </span>
              )}
            </div>
            <p className="text-sm text-surface-700 leading-relaxed mb-4">
              &ldquo;{assembly.recommendation}&rdquo;
            </p>

            {/* Observer reactions */}
            <div className="flex items-center gap-3 pt-3 border-t border-emerald/15">
              <span className="text-xs text-surface-600">Community response:</span>
              {(['endorse', 'question', 'object'] as const).map((r) => {
                const counts = { endorse: assembly.endorse_count, question: assembly.question_count, object: assembly.object_count }
                const icons = { endorse: ThumbsUp, question: HelpCircle, object: ThumbsDown }
                const colors = { endorse: 'text-emerald', question: 'text-gold', object: 'text-against-400' }
                const bgs = { endorse: 'bg-emerald/10 border-emerald/30', question: 'bg-gold/10 border-gold/30', object: 'bg-against-500/10 border-against-500/30' }
                const Icon = icons[r]
                const isActive = assembly.user_reaction === r
                return (
                  <button
                    key={r}
                    onClick={() => handleReact(r)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all capitalize',
                      isActive
                        ? `${colors[r]} ${bgs[r]}`
                        : 'text-surface-500 bg-surface-200 border-surface-300 hover:border-surface-400'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {r} <span className="font-semibold">{counts[r]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Deliberations */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-mono font-semibold text-surface-600">
              Deliberations
              {assembly.deliberations.length > 0 && (
                <span className="ml-2 text-surface-700">({assembly.deliberations.length})</span>
              )}
            </h2>
          </div>

          {assembly.deliberations.length === 0 ? (
            <div className="text-center py-10 text-surface-600">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {assembly.status === 'forming'
                  ? 'Deliberations begin once the assembly is fully seated.'
                  : 'No deliberations posted yet. Members should begin discussing.'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-4">
                {Array.from(roundMap.entries()).map(([round, posts]) => (
                  <div key={round}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-surface-300" />
                      <span className="text-[10px] font-mono text-surface-600 bg-surface-200 border border-surface-300 px-2 py-1 rounded">
                        Round {round}
                      </span>
                      <div className="h-px flex-1 bg-surface-300" />
                    </div>
                    <div className="space-y-3">
                      {posts.map((post) => (
                        <DeliberationCard key={post.id} post={post} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Post form for members */}
        {assembly.user_is_member && assembly.status === 'deliberating' && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <span className="text-xs font-mono text-surface-600">Your deliberation</span>
            <DeliberationForm
              assemblyId={assembly.id}
              roundNumber={Math.max(...Array.from(roundMap.keys()), 0) + 1}
              onPosted={() => fetchAssembly(true)}
            />
          </div>
        )}

        {/* Chair conclude form */}
        {assembly.user_is_chair && assembly.status === 'deliberating' && (
          <div className="rounded-2xl bg-gold/5 border border-gold/20 p-4">
            <ConcludeForm assemblyId={assembly.id} onConcluded={() => fetchAssembly(true)} />
            <p className="text-[11px] text-surface-600 mt-2">
              As chair, you can submit the assembly&apos;s collective recommendation when deliberations
              are complete. This will conclude the assembly.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
