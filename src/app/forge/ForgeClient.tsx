'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Hammer,
  Lightbulb,
  Loader2,
  Save,
  Scale,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Suspense } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForgeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface ForgeDraft {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  updated_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  }
}

// ─── Quality computation ──────────────────────────────────────────────────────

const EVIDENCE_KEYWORDS = [
  'research', 'study', 'data', 'evidence', 'shows', 'proves', 'demonstrates',
  'according to', 'statistics', 'report', 'survey', 'analysis', 'expert',
  'science', 'fact', 'example', 'historically', 'proven', 'documented',
]

const RHETORICAL_WORDS = [
  'because', 'therefore', 'however', 'although', 'despite', 'furthermore',
  'moreover', 'consequently', 'thus', 'since', 'given that', 'clearly',
  'importantly', 'specifically',
]

interface QualityBreakdown {
  score: number
  length: number
  structure: number
  evidence: number
  reasoning: number
  label: string
  color: string
  tips: string[]
}

function computeQuality(text: string): QualityBreakdown {
  const t = text.trim()
  const charCount = t.length
  const lower = t.toLowerCase()

  // Length (0-35 pts): sweet spot is 200-400 chars
  let lengthPts = 0
  if (charCount >= 10) lengthPts = Math.min(35, Math.round((charCount / 400) * 35))
  if (charCount > 400) lengthPts = Math.max(25, 35 - Math.round(((charCount - 400) / 200) * 10))

  // Structure (0-25 pts): proper sentences, no all-caps
  let structurePts = 0
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 3)
  if (sentences.length >= 2) structurePts += 10
  if (sentences.length >= 3) structurePts += 8
  if (/[.!?]$/.test(t)) structurePts += 4
  const upperRatio = (t.match(/[A-Z]/g) ?? []).length / Math.max(1, charCount)
  if (upperRatio < 0.3) structurePts += 3

  // Evidence (0-20 pts): uses evidence keywords
  const evidenceHits = EVIDENCE_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const evidencePts = Math.min(20, evidenceHits * 7)

  // Reasoning (0-20 pts): uses connective/reasoning words
  const reasoningHits = RHETORICAL_WORDS.filter((kw) => lower.includes(kw)).length
  const reasoningPts = Math.min(20, reasoningHits * 6)

  const total = lengthPts + structurePts + evidencePts + reasoningPts

  const tips: string[] = []
  if (charCount < 80) tips.push('Expand your argument — more detail is more persuasive.')
  if (sentences.length < 2) tips.push('Write at least 2 complete sentences.')
  if (evidencePts === 0) tips.push('Add evidence or data to strengthen your case.')
  if (reasoningPts === 0) tips.push('Use connective words (because, therefore, however) to build a logical chain.')
  if (charCount > 450) tips.push('You\'re near the 500-char limit — trim for punch.')

  let label: string
  let color: string
  if (total >= 75) { label = 'Strong'; color = 'text-emerald' }
  else if (total >= 55) { label = 'Good'; color = 'text-for-400' }
  else if (total >= 35) { label = 'Developing'; color = 'text-gold' }
  else { label = 'Weak'; color = 'text-against-400' }

  return { score: total, length: lengthPts, structure: structurePts, evidence: evidencePts, reasoning: reasoningPts, label, color, tips }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 500

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-surface-400',
  Culture: 'text-pink-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const FORGE_TIPS = [
  { icon: Lightbulb, tip: 'Lead with your strongest point — readers decide in the first sentence.' },
  { icon: BookOpen, tip: 'Cite real-world evidence: studies, statistics, or specific examples.' },
  { icon: Scale, tip: 'Acknowledge the best counter-argument, then explain why yours still wins.' },
  { icon: Zap, tip: 'Every sentence should serve your position. Cut anything that doesn\'t.' },
  { icon: Sparkles, tip: 'Specific beats vague. "30% reduction" beats "significant improvement."' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function QualityBar({ pts, max, color }: { pts: number; max: number; color: string }) {
  return (
    <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round((pts / max) * 100)}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Topic Search ─────────────────────────────────────────────────────────────

function TopicSearchPanel({
  selected,
  onSelect,
  drafts,
}: {
  selected: ForgeTopic | null
  onSelect: (topic: ForgeTopic) => void
  drafts: ForgeDraft[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ForgeTopic[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
      if (!res.ok) return
      const { results: raw } = await res.json() as { results: ForgeTopic[] }
      setResults(raw ?? [])
    } catch {
      // silent
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const draftTopics = drafts
    .map((d) => ({ id: d.topic.id, statement: d.topic.statement, category: d.topic.category, status: d.topic.status, blue_pct: 50, total_votes: 0 }))
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)

  const showResults = query.length >= 2
  const displayList: ForgeTopic[] = showResults ? results : draftTopics

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search topics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-surface-200 border border-surface-300 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60 transition-colors"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
        )}
        {query && !searching && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!showResults && draftTopics.length > 0 && (
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">Your drafts</p>
      )}
      {!showResults && draftTopics.length === 0 && (
        <p className="text-[11px] text-surface-500 text-center mt-4">Search for a topic above to get started.</p>
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        <AnimatePresence mode="popLayout">
          {displayList.map((topic, i) => {
            const isSelected = selected?.id === topic.id
            const hasDraft = drafts.some((d) => d.topic.id === topic.id)
            return (
              <motion.button
                key={topic.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelect(topic)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all text-sm',
                  isSelected
                    ? 'bg-for-600/20 border-for-500/50 text-white'
                    : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60 text-surface-300 hover:text-white'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="leading-snug line-clamp-2 flex-1">{topic.statement}</p>
                  {isSelected && <Check className="h-3.5 w-3.5 text-for-400 shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {topic.category && (
                    <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-400')}>
                      {topic.category}
                    </span>
                  )}
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
                    {topic.status.toUpperCase()}
                  </Badge>
                  {hasDraft && (
                    <span className="text-[10px] font-mono text-gold ml-auto">DRAFT</span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Main forge component ─────────────────────────────────────────────────────

function ForgeInner() {
  const searchParams = useSearchParams()

  const [topic, setTopic] = useState<ForgeTopic | null>(null)
  const [side, setSide] = useState<'blue' | 'red'>('blue')
  const [content, setContent] = useState('')
  const [drafts, setDrafts] = useState<ForgeDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [postResult, setPostResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const quality = computeQuality(content)
  const charCount = content.length
  const charPct = Math.round((charCount / MAX_CHARS) * 100)

  // Load user's drafts
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/arguments/drafts')
        if (!res.ok) return
        const { drafts: raw } = await res.json() as { drafts: ForgeDraft[] }
        setDrafts(raw ?? [])

        // If ?topic=<id> is in the URL, pre-select it
        const topicId = searchParams.get('topic')
        if (topicId) {
          const match = raw?.find((d: ForgeDraft) => d.topic.id === topicId)
          if (match) {
            setTopic({ id: match.topic.id, statement: match.topic.statement, category: match.topic.category, status: match.topic.status, blue_pct: 50, total_votes: 0 })
            setSide(match.side)
            setContent(match.content)
          }
        }
      } catch {
        // silent
      } finally {
        setLoadingDrafts(false)
      }
    }
    load()
  }, [searchParams])

  // When topic changes, load the existing draft for that topic
  const handleTopicSelect = useCallback(async (t: ForgeTopic) => {
    setTopic(t)
    setPostResult(null)
    const existingDraft = drafts.find((d) => d.topic.id === t.id)
    if (existingDraft) {
      setSide(existingDraft.side)
      setContent(existingDraft.content)
      setSavedAt(new Date(existingDraft.updated_at))
    } else {
      setContent('')
      setSavedAt(null)
    }
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [drafts])

  // Rotate tips
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % FORGE_TIPS.length), 6000)
    return () => clearInterval(id)
  }, [])

  // Auto-save draft after 2s of inactivity
  useEffect(() => {
    if (!topic || !content.trim()) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/arguments/drafts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_id: topic.id, side, content: content.trim() }),
        })
        setSavedAt(new Date())
        setDrafts((prev) => {
          const existing = prev.find((d) => d.topic.id === topic.id)
          if (existing) {
            return prev.map((d) => d.topic.id === topic.id ? { ...d, side, content: content.trim(), updated_at: new Date().toISOString() } : d)
          }
          return prev
        })
      } catch {
        // silent
      }
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [topic, side, content])

  const handleSaveDraft = async () => {
    if (!topic || !content.trim()) return
    setSaving(true)
    try {
      await fetch('/api/arguments/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id, side, content: content.trim() }),
      })
      setSavedAt(new Date())
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async () => {
    if (!topic || !content.trim() || charCount > MAX_CHARS || charCount < 10) return
    setPosting(true)
    setPostResult(null)
    try {
      const res = await fetch(`/api/topics/${topic.id}/arguments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, content: content.trim() }),
      })
      if (res.ok) {
        setPostResult({ ok: true, message: 'Posted! Your argument is live on the topic.' })
        // Delete the draft now that it's posted
        await fetch(`/api/arguments/drafts/by-topic/${topic.id}`, { method: 'DELETE' })
        setDrafts((prev) => prev.filter((d) => d.topic.id !== topic.id))
        setSavedAt(null)
      } else {
        const err = await res.json() as { error?: string }
        setPostResult({ ok: false, message: err.error ?? 'Failed to post. Try again.' })
      }
    } catch {
      setPostResult({ ok: false, message: 'Network error. Try again.' })
    } finally {
      setPosting(false)
    }
  }

  const handleDiscard = async () => {
    if (!topic) return
    setContent('')
    setSavedAt(null)
    setPostResult(null)
    try {
      await fetch(`/api/arguments/drafts/by-topic/${topic.id}`, { method: 'DELETE' })
      setDrafts((prev) => prev.filter((d) => d.topic.id !== topic.id))
    } catch {
      // silent
    }
  }

  const canPost = !!topic && charCount >= 10 && charCount <= MAX_CHARS && !posting

  const currentTip = FORGE_TIPS[tipIndex]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors text-surface-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-surface-200 border border-surface-300">
              <Hammer className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">The Argument Forge</h1>
              <p className="text-[11px] text-surface-500 font-mono">Craft · Refine · Post</p>
            </div>
          </div>

          {/* Drafts count chip */}
          {drafts.length > 0 && (
            <Link
              href="/drafts"
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors text-[11px] text-surface-400 hover:text-white"
            >
              <Save className="h-3 w-3" />
              {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Main layout — 3 columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4">

          {/* ── Column 1: Topic picker ─────────────────────────────────── */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex flex-col min-h-[400px] lg:min-h-[580px]">
            <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Select Topic
            </h2>
            {loadingDrafts ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : (
              <TopicSearchPanel selected={topic} onSelect={handleTopicSelect} drafts={drafts} />
            )}
          </div>

          {/* ── Column 2: Writing canvas ───────────────────────────────── */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 flex flex-col min-h-[400px] lg:min-h-[580px]">

            {/* Topic preview */}
            {topic ? (
              <div className="mb-4 p-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <p className="text-sm font-medium text-white leading-snug line-clamp-2">{topic.statement}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {topic.category && (
                    <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-400')}>
                      {topic.category}
                    </span>
                  )}
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
                    {topic.status.toUpperCase()}
                  </Badge>
                  <Link href={`/topic/${topic.id}`} className="ml-auto text-[10px] text-surface-500 hover:text-for-400 flex items-center gap-1 transition-colors">
                    View topic <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-xl bg-surface-200/40 border border-dashed border-surface-400/50 text-center">
                <p className="text-sm text-surface-500">Select a topic from the left panel to begin.</p>
              </div>
            )}

            {/* Side toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide('blue')}
                disabled={!topic}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all',
                  side === 'blue' && topic
                    ? 'bg-for-600/30 border-for-500/60 text-for-300'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400',
                  !topic && 'opacity-40 cursor-not-allowed'
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                FOR
              </button>
              <button
                onClick={() => setSide('red')}
                disabled={!topic}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all',
                  side === 'red' && topic
                    ? 'bg-against-600/30 border-against-500/60 text-against-300'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400',
                  !topic && 'opacity-40 cursor-not-allowed'
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                AGAINST
              </button>
            </div>

            {/* Textarea */}
            <div className="relative flex-1 flex flex-col">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) setContent(e.target.value)
                  setPostResult(null)
                }}
                disabled={!topic}
                placeholder={
                  !topic
                    ? 'Select a topic first…'
                    : side === 'blue'
                    ? 'Make your case FOR this topic. Be specific, cite evidence, address the strongest counterargument…'
                    : 'Make your case AGAINST this topic. Be specific, cite evidence, address the strongest counterargument…'
                }
                className={cn(
                  'flex-1 w-full resize-none bg-surface-200/50 border rounded-xl p-4 text-sm text-white placeholder-surface-500',
                  'focus:outline-none transition-colors',
                  !topic ? 'opacity-50 cursor-not-allowed' : '',
                  topic && side === 'blue' ? 'border-for-500/40 focus:border-for-500/70' : '',
                  topic && side === 'red' ? 'border-against-500/40 focus:border-against-500/70' : '',
                  !topic ? 'border-surface-300' : '',
                  'min-h-[180px]'
                )}
              />

              {/* Char counter */}
              <div className={cn(
                'mt-2 flex items-center justify-between text-[11px] font-mono',
                charCount > MAX_CHARS * 0.9 ? 'text-against-400' : 'text-surface-500'
              )}>
                <span>{charCount < 10 && charCount > 0 ? 'Too short — needs at least 10 characters' : ''}</span>
                <span>{charCount}/{MAX_CHARS}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 h-1 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    charPct > 90 ? 'bg-against-500' : charPct > 70 ? 'bg-gold' : 'bg-for-500'
                  )}
                  animate={{ width: `${charPct}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>

            {/* Post result banner */}
            <AnimatePresence>
              {postResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className={cn(
                    'mt-3 p-3 rounded-xl flex items-center gap-2 text-sm',
                    postResult.ok
                      ? 'bg-emerald/10 border border-emerald/30 text-emerald'
                      : 'bg-against-600/10 border border-against-500/30 text-against-300'
                  )}
                >
                  {postResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{postResult.message}</span>
                  {postResult.ok && topic && (
                    <Link href={`/topic/${topic.id}`} className="ml-auto flex items-center gap-1 text-xs underline hover:no-underline shrink-0">
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action row */}
            <div className="mt-4 flex items-center gap-2">
              {/* Auto-save indicator */}
              <div className="text-[10px] text-surface-500 font-mono flex items-center gap-1 flex-1">
                {saving && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
                {!saving && savedAt && <><Check className="h-3 w-3 text-emerald" /> Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
                {!saving && !savedAt && content && topic && <span className="text-surface-600">Auto-saves after 2s…</span>}
              </div>

              {content && topic && (
                <button
                  onClick={handleDiscard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-against-600/20 border border-surface-300 hover:border-against-500/40 text-xs text-surface-400 hover:text-against-300 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                  Discard
                </button>
              )}

              <button
                onClick={handleSaveDraft}
                disabled={!topic || !content.trim() || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 text-xs text-surface-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-3 w-3" />
                Save Draft
              </button>

              <button
                onClick={handlePost}
                disabled={!canPost}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  canPost
                    ? side === 'blue'
                      ? 'bg-for-600 border-for-500 text-white hover:bg-for-500'
                      : 'bg-against-600 border-against-500 text-white hover:bg-against-500'
                    : 'bg-surface-200 border-surface-300 text-surface-500 cursor-not-allowed opacity-50'
                )}
              >
                {posting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Post Argument
              </button>
            </div>
          </div>

          {/* ── Column 3: Quality panel + tips ────────────────────────── */}
          <div className="space-y-4">

            {/* Quality score */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
              <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Quality Score
              </h2>

              {content.length > 0 ? (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className={cn('text-4xl font-mono font-bold', quality.color)}>{quality.score}</span>
                    <span className="text-surface-500 text-sm">/100</span>
                    <span className={cn('ml-auto text-sm font-semibold', quality.color)}>{quality.label}</span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
                        <span>Length</span><span>{quality.length}/35</span>
                      </div>
                      <QualityBar pts={quality.length} max={35} color="bg-for-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
                        <span>Structure</span><span>{quality.structure}/25</span>
                      </div>
                      <QualityBar pts={quality.structure} max={25} color="bg-purple" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
                        <span>Evidence</span><span>{quality.evidence}/20</span>
                      </div>
                      <QualityBar pts={quality.evidence} max={20} color="bg-emerald" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
                        <span>Reasoning</span><span>{quality.reasoning}/20</span>
                      </div>
                      <QualityBar pts={quality.reasoning} max={20} color="bg-gold" />
                    </div>
                  </div>

                  {/* Improvement tips */}
                  {quality.tips.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {quality.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-surface-400">
                          <AlertCircle className="h-3 w-3 text-gold shrink-0 mt-0.5" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-surface-500 text-center py-4">
                  Quality metrics will appear as you write.
                </p>
              )}
            </div>

            {/* Rotating tip */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tipIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="bg-surface-100 border border-surface-300 rounded-2xl p-4"
              >
                <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-gold" />
                  Forge Tip
                </h2>
                <div className="flex items-start gap-2">
                  <currentTip.icon className="h-4 w-4 text-for-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-300 leading-relaxed">{currentTip.tip}</p>
                </div>
                <div className="flex justify-center gap-1 mt-3">
                  {FORGE_TIPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTipIndex(i)}
                      className={cn(
                        'h-1 rounded-full transition-all',
                        i === tipIndex ? 'w-4 bg-for-400' : 'w-1.5 bg-surface-400 hover:bg-surface-300'
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Link to view similar arguments */}
            {topic && (
              <Link
                href={`/topic/${topic.id}#arguments`}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
              >
                <div className="p-1.5 rounded-lg bg-surface-200">
                  <Flame className="h-3.5 w-3.5 text-against-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">View existing arguments</p>
                  <p className="text-[10px] text-surface-500 truncate">See what others have argued on this topic</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors shrink-0" />
              </Link>
            )}

            {/* Link to drafts page */}
            <Link
              href="/drafts"
              className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-surface-200">
                <BookOpen className="h-3.5 w-3.5 text-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">All your drafts</p>
                <p className="text-[10px] text-surface-500">
                  {drafts.length > 0 ? `${drafts.length} saved` : 'No drafts yet'}
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors shrink-0" />
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

export function ForgeClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
      </div>
    }>
      <ForgeInner />
    </Suspense>
  )
}
