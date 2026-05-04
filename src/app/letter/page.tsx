'use client'

/**
 * /letter — Civic Letter Generator
 *
 * AI-powered tool that helps citizens craft formal letters, op-eds,
 * petition statements, or social threads based on any Lobby Market topic.
 *
 * Built on the same Claude backbone as /manifesto, /coach, and /simulate.
 * Requires authentication. No data stored — letters are ephemeral and
 * copy-to-clipboard only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Loader2,
  Mail,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Scale,
  Search,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { LetterResult, LetterType, LetterPosition } from '@/app/api/letter/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LETTER_TYPES: {
  id: LetterType
  label: string
  sublabel: string
  icon: typeof Mail
  color: string
  bg: string
  border: string
}[] = [
  {
    id: 'representative',
    label: 'Letter to Representative',
    sublabel: 'Formal appeal to an elected official',
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  {
    id: 'opEd',
    label: 'Op-Ed / Letter to Editor',
    sublabel: 'Newspaper-ready persuasive essay',
    icon: Newspaper,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  {
    id: 'petition',
    label: 'Petition Statement',
    sublabel: 'Open letter inviting co-signers',
    icon: Users,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  {
    id: 'social',
    label: 'Social Media Thread',
    sublabel: 'Shareable posts with civic impact',
    icon: MessageCircle,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
]

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
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-full border text-xs font-mono font-bold transition-all',
        done
          ? 'bg-emerald/20 border-emerald/40 text-emerald'
          : active
            ? 'bg-for-500/20 border-for-500/40 text-for-300'
            : 'bg-surface-200 border-surface-400 text-surface-500',
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </div>
  )
}

// ─── Search panel ─────────────────────────────────────────────────────────────

function TopicSearch({
  selected,
  onSelect,
}: {
  selected: TopicResult | null
  onSelect: (t: TopicResult | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
      const data = await res.json() as { results?: TopicResult[] }
      setResults((data.results ?? []).slice(0, 8))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  if (selected) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-for-500/30 bg-for-500/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {selected.category && (
              <span className={cn('text-[10px] font-mono uppercase tracking-widest', CATEGORY_COLOR[selected.category] ?? 'text-surface-500')}>
                {selected.category}
              </span>
            )}
            <Badge variant={STATUS_BADGE[selected.status] ?? 'proposed'}>
              {selected.status === 'voting' ? 'Voting' : selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm font-mono text-white leading-snug">{selected.statement}</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-1.5 w-24 rounded-full bg-surface-300 overflow-hidden">
              <div className="h-full bg-for-500" style={{ width: `${Math.round(selected.blue_pct)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-surface-500">
              {Math.round(selected.blue_pct)}% For · {(selected.total_votes ?? 0).toLocaleString()} votes
            </span>
          </div>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          aria-label="Remove selected topic"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search for a civic topic…"
          className={cn(
            'w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono',
            'bg-surface-100 border border-surface-300 text-white placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50',
            'transition-all',
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden">
          {results.map((topic) => (
            <button
              key={topic.id}
              onClick={() => { onSelect(topic); setQuery(''); setResults([]) }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {topic.category && (
                    <span className={cn('text-[10px] font-mono uppercase tracking-widest', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                      {topic.category}
                    </span>
                  )}
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                    {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm font-mono text-surface-700 group-hover:text-white line-clamp-2 transition-colors">
                  {topic.statement}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                  {Math.round(topic.blue_pct)}% For · {(topic.total_votes ?? 0).toLocaleString()} votes
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {!loading && query.length > 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <p className="text-sm font-mono text-surface-500 text-center">No topics found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

// ─── Generated letter view ────────────────────────────────────────────────────

function LetterView({
  letter,
  letterType,
  topic,
  position,
  onReset,
  onRegenerate,
  regenerating,
}: {
  letter: LetterResult
  letterType: LetterType
  topic: TopicResult
  position: LetterPosition
  onReset: () => void
  onRegenerate: () => void
  regenerating: boolean
}) {
  const [copied, setCopied] = useState(false)
  const typeConfig = LETTER_TYPES.find((t) => t.id === letterType)!

  const fullText = [
    letter.subject ? `Subject: ${letter.subject}` : '',
    '',
    letter.salutation,
    '',
    ...letter.body.map((p) => p),
    '',
    letter.closing,
    '',
    letter.signature_block,
    '[Your Name]',
    '[Your Contact Information]',
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select all in textarea
    }
  }

  const handleShare = async () => {
    const shareUrl = `/topic/${topic.id}`
    const shareData = {
      title: letter.subject || 'Civic Letter',
      text: `I wrote a civic letter about: "${topic.statement.slice(0, 100)}…"\n\nGenerated on Lobby Market`,
      url: typeof window !== 'undefined' ? window.location.origin + shareUrl : shareUrl,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* cancelled */ }
    } else {
      handleCopy()
    }
  }

  const TypeIcon = typeConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg border', typeConfig.bg, typeConfig.border)}>
            <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
          </div>
          <div>
            <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">{typeConfig.label}</p>
            <p className="text-sm font-mono text-white leading-snug line-clamp-1">{topic.statement.slice(0, 70)}…</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            New
          </button>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
            Regenerate
          </button>
        </div>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold',
          position === 'for'
            ? 'bg-for-500/15 border-for-500/30 text-for-300'
            : 'bg-against-500/15 border-against-500/30 text-against-300',
        )}>
          {position === 'for' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {position === 'for' ? 'FOR position' : 'AGAINST position'}
        </span>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-surface-400 bg-surface-200 text-[11px] font-mono text-surface-500">
          <FileText className="h-3 w-3" />
          ~{letter.word_count} words
        </span>

        {topic.category && (
          <span className={cn('text-[11px] font-mono px-2.5 py-1 rounded-full border border-surface-400 bg-surface-200', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
            {topic.category}
          </span>
        )}
      </div>

      {/* Call to action */}
      {letter.call_to_action && (
        <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-gold/70 mb-1">Call to Action</p>
          <p className="text-sm font-mono text-gold">{letter.call_to_action}</p>
        </div>
      )}

      {/* Letter body */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-300 flex items-center justify-between">
          <div className="space-y-0.5">
            {letter.subject && (
              <p className="text-xs font-mono text-surface-500">
                <span className="text-surface-400">Subject:</span> {letter.subject}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white bg-surface-200 hover:bg-surface-300 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                copied
                  ? 'bg-emerald/20 text-emerald border border-emerald/30'
                  : 'bg-for-600/80 text-white hover:bg-for-700 border border-for-600',
              )}
            >
              {copied ? (
                <><ClipboardCheck className="h-3.5 w-3.5" /> Copied!</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy All</>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 font-mono text-sm text-surface-700 leading-relaxed">
          {letter.salutation && (
            <p className="text-surface-600">{letter.salutation}</p>
          )}

          {letter.body.map((para, i) => (
            <p key={i} className="text-surface-700 leading-7">
              {para}
            </p>
          ))}

          {letter.closing && (
            <p className="text-surface-600 pt-2">{letter.closing}</p>
          )}

          <div className="pt-1 space-y-0.5 text-surface-500">
            <p>{letter.signature_block}</p>
            <p className="italic text-surface-400">[Your Name]</p>
            <p className="italic text-surface-400 text-xs">[Your Contact Information]</p>
          </div>
        </div>
      </div>

      {/* Topic link */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-mono text-surface-500">
          Generated from community data · {new Date(letter.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          View debate <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LetterPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1 state
  const [selectedTopic, setSelectedTopic] = useState<TopicResult | null>(null)

  // Step 2 state
  const [position, setPosition] = useState<LetterPosition | null>(null)

  // Step 3 state
  const [letterType, setLetterType] = useState<LetterType | null>(null)

  // Step 4 — optional recipient
  const [recipientName, setRecipientName] = useState('')
  const [recipientTitle, setRecipientTitle] = useState('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [letter, setLetter] = useState<LetterResult | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // Derived
  const canGenerate = !!selectedTopic && !!position && !!letterType

  useEffect(() => {
    if (selectedTopic && step < 2) setStep(2)
  }, [selectedTopic, step])

  useEffect(() => {
    if (position && step < 3) setStep(3)
  }, [position, step])

  useEffect(() => {
    if (letterType && step < 4) setStep(4)
  }, [letterType, step])

  const generate = useCallback(async () => {
    if (!selectedTopic || !position || !letterType) return
    setGenerating(true)
    setGenError(null)
    setUnavailable(false)

    try {
      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          topic_statement: selectedTopic.statement,
          category: selectedTopic.category,
          blue_pct: selectedTopic.blue_pct,
          total_votes: selectedTopic.total_votes,
          position,
          letter_type: letterType,
          recipient_name: recipientName.trim() || undefined,
          recipient_title: recipientTitle.trim() || undefined,
        }),
      })

      const data = await res.json() as LetterResult

      if (data.unavailable) {
        setUnavailable(true)
        return
      }

      if (!res.ok) {
        setGenError('Generation failed. Please try again.')
        return
      }

      setLetter(data)
    } catch {
      setGenError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [selectedTopic, position, letterType, recipientName, recipientTitle])

  const handleReset = () => {
    setLetter(null)
    setGenError(null)
    setStep(1)
    setSelectedTopic(null)
    setPosition(null)
    setLetterType(null)
    setRecipientName('')
    setRecipientTitle('')
  }

  // ── Generated letter view ───────────────────────────────────────────────────

  if (letter && selectedTopic && position && letterType) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              New letter
            </button>
          </div>
          <LetterView
            letter={letter}
            letterType={letterType}
            topic={selectedTopic}
            position={position}
            onReset={handleReset}
            onRegenerate={generate}
            regenerating={generating}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Builder view ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Mail className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Letter Generator</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Turn your civic position into a formal letter, op-ed, or petition
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <StepDot n={n} active={step === n} done={step > n} />
                {n < 4 && (
                  <div className={cn('h-px flex-1 w-8 transition-colors', step > n ? 'bg-emerald/40' : 'bg-surface-300')} />
                )}
              </div>
            ))}
            <p className="ml-3 text-xs font-mono text-surface-500 whitespace-nowrap">
              Step {step} of 4
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6">

          {/* Step 1: Topic */}
          <div className={cn(
            'rounded-2xl border p-5 transition-all',
            step === 1 ? 'border-for-500/40 bg-surface-100' : selectedTopic ? 'border-emerald/30 bg-surface-100' : 'border-surface-300 bg-surface-100 opacity-60',
          )}>
            <div className="flex items-center gap-3 mb-4">
              <StepDot n={1} active={step === 1} done={step > 1} />
              <h2 className="font-mono text-sm font-bold text-white">Choose a topic</h2>
            </div>
            <TopicSearch selected={selectedTopic} onSelect={setSelectedTopic} />
          </div>

          {/* Step 2: Position */}
          <AnimatePresence>
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'rounded-2xl border p-5 transition-all',
                  step === 2 ? 'border-for-500/40 bg-surface-100' : position ? 'border-emerald/30 bg-surface-100' : 'border-surface-300 bg-surface-100',
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <StepDot n={2} active={step === 2} done={step > 2} />
                  <h2 className="font-mono text-sm font-bold text-white">Your position</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPosition('for')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                      position === 'for'
                        ? 'bg-for-500/20 border-for-500/50 text-for-300'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/30 hover:text-for-400',
                    )}
                  >
                    <ThumbsUp className="h-6 w-6" />
                    <span className="text-sm font-mono font-semibold">FOR</span>
                    <span className="text-[11px] font-mono text-center opacity-70">I support this proposal</span>
                    {selectedTopic && (
                      <span className="text-[10px] font-mono opacity-50">{Math.round(selectedTopic.blue_pct)}% agree</span>
                    )}
                  </button>
                  <button
                    onClick={() => setPosition('against')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                      position === 'against'
                        ? 'bg-against-500/20 border-against-500/50 text-against-300'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-against-500/30 hover:text-against-400',
                    )}
                  >
                    <ThumbsDown className="h-6 w-6" />
                    <span className="text-sm font-mono font-semibold">AGAINST</span>
                    <span className="text-[11px] font-mono text-center opacity-70">I oppose this proposal</span>
                    {selectedTopic && (
                      <span className="text-[10px] font-mono opacity-50">{100 - Math.round(selectedTopic.blue_pct)}% agree</span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Letter type */}
          <AnimatePresence>
            {step >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'rounded-2xl border p-5 transition-all',
                  step === 3 ? 'border-for-500/40 bg-surface-100' : letterType ? 'border-emerald/30 bg-surface-100' : 'border-surface-300 bg-surface-100',
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <StepDot n={3} active={step === 3} done={step > 3} />
                  <h2 className="font-mono text-sm font-bold text-white">Letter format</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LETTER_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = letterType === type.id
                    return (
                      <button
                        key={type.id}
                        onClick={() => setLetterType(type.id)}
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                          isSelected
                            ? cn(type.bg, type.border, type.color)
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
                        )}
                      >
                        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', isSelected ? type.color : 'text-surface-500')} />
                        <div>
                          <p className={cn('text-sm font-mono font-semibold', isSelected ? type.color : 'text-white')}>{type.label}</p>
                          <p className="text-[11px] font-mono opacity-70 mt-0.5">{type.sublabel}</p>
                        </div>
                        {isSelected && <Check className={cn('h-4 w-4 ml-auto flex-shrink-0', type.color)} />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 4: Optional recipient + generate */}
          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-for-500/40 bg-surface-100 p-5 space-y-5"
              >
                <div className="flex items-center gap-3">
                  <StepDot n={4} active={true} done={false} />
                  <h2 className="font-mono text-sm font-bold text-white">
                    {letterType === 'representative' ? 'Recipient details (optional)' : 'Ready to generate'}
                  </h2>
                </div>

                {letterType === 'representative' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-1.5">
                        Representative name
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Senator Jane Smith"
                        className={cn(
                          'w-full px-3 py-2.5 rounded-lg text-sm font-mono',
                          'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                          'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50',
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-1.5">
                        Title / office
                      </label>
                      <input
                        type="text"
                        value={recipientTitle}
                        onChange={(e) => setRecipientTitle(e.target.value)}
                        placeholder="e.g. Senator, District 7"
                        className={cn(
                          'w-full px-3 py-2.5 rounded-lg text-sm font-mono',
                          'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                          'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50',
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="rounded-xl border border-surface-300 bg-surface-200 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Summary</p>
                  <div className="flex items-start gap-2 text-xs font-mono">
                    <Zap className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                    <span className="text-surface-400">Topic:</span>
                    <span className="text-white line-clamp-2">{selectedTopic?.statement}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {position === 'for' ? (
                      <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                    )}
                    <span className="text-surface-400">Position:</span>
                    <span className={position === 'for' ? 'text-for-300' : 'text-against-300'}>
                      {position === 'for' ? 'FOR (supporting)' : 'AGAINST (opposing)'}
                    </span>
                  </div>
                  {letterType && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <FileText className="h-3.5 w-3.5 text-purple flex-shrink-0" />
                      <span className="text-surface-400">Format:</span>
                      <span className="text-white">{LETTER_TYPES.find((t) => t.id === letterType)?.label}</span>
                    </div>
                  )}
                </div>

                {/* Error state */}
                {genError && (
                  <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3">
                    <p className="text-sm font-mono text-against-400">{genError}</p>
                  </div>
                )}

                {/* Unavailable state */}
                {unavailable && (
                  <div className="rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
                    <p className="text-sm font-mono text-surface-500">
                      AI generation is not available right now. Please try again later.
                    </p>
                  </div>
                )}

                {/* Generate button */}
                <Button
                  onClick={generate}
                  disabled={!canGenerate || generating}
                  variant="for"
                  size="lg"
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Drafting your letter…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Letter
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>

                <p className="text-[11px] font-mono text-surface-500 text-center">
                  Powered by Claude · Generation takes ~5 seconds · Letters are not stored
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-surface-500">
          <Link href="/manifesto" className="hover:text-white transition-colors flex items-center gap-1">
            <Gavel className="h-3 w-3" /> Civic Manifesto
          </Link>
          <Link href="/coach" className="hover:text-white transition-colors flex items-center gap-1">
            <Bot className="h-3 w-3" /> Argument Coach
          </Link>
          <Link href="/perspective" className="hover:text-white transition-colors flex items-center gap-1">
            <Scale className="h-3 w-3" /> Perspective Swap
          </Link>
          <Link href="/simulate" className="hover:text-white transition-colors flex items-center gap-1">
            <Zap className="h-3 w-3" /> Policy Simulator
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
