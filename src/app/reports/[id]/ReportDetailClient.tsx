'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ThumbsUp,
  Eye,
  Tag,
  FileText,
  ExternalLink,
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { CommitteeReport } from '@/app/api/committee-reports/route'

interface Props {
  report: CommitteeReport
  currentUserId: string | null
}

const CAT_STYLE: Record<string, string> = {
  Economics: 'text-gold bg-gold/10 border-gold/30',
  Politics: 'text-for-400 bg-for-500/10 border-for-500/30',
  Technology: 'text-purple bg-purple/10 border-purple/30',
  Science: 'text-emerald bg-emerald/10 border-emerald/30',
  Ethics: 'text-against-400 bg-against-500/10 border-against-500/30',
  Philosophy: 'text-purple bg-purple/10 border-purple/30',
  Culture: 'text-gold bg-gold/10 border-gold/30',
  Health: 'text-emerald bg-emerald/10 border-emerald/30',
  Education: 'text-for-400 bg-for-500/10 border-for-500/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
}

const RECOMMENDATION_CONFIG = {
  for: {
    label: 'Recommends: FOR',
    icon: CheckCircle2,
    cls: 'text-for-400 bg-for-500/10 border-for-500/30',
    banner: 'bg-for-500/10 border-for-500/30 text-for-300',
  },
  against: {
    label: 'Recommends: AGAINST',
    icon: XCircle,
    cls: 'text-against-400 bg-against-500/10 border-against-500/30',
    banner: 'bg-against-500/10 border-against-500/30 text-against-300',
  },
  neutral: {
    label: 'No Recommendation',
    icon: MinusCircle,
    cls: 'text-surface-400 bg-surface-300/20 border-surface-400/30',
    banner: 'bg-surface-200/50 border-surface-400/30 text-surface-300',
  },
  hold: {
    label: 'Recommends: HOLD',
    icon: Clock,
    cls: 'text-gold bg-gold/10 border-gold/30',
    banner: 'bg-gold/10 border-gold/30 text-gold',
  },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ReportDetailClient({ report, currentUserId }: Props) {
  const [endorseCount, setEndorseCount] = useState(report.endorsement_count)
  const [endorsed, setEndorsed] = useState(report.user_endorsed)
  const [endorsing, setEndorsing] = useState(false)

  const rec = RECOMMENDATION_CONFIG[report.recommendation]
  const RecIcon = rec.icon
  const catStyle = CAT_STYLE[report.category] ?? 'text-surface-400 bg-surface-300/20 border-surface-400/30'

  const handleEndorse = useCallback(async () => {
    if (!currentUserId || endorsing) return
    setEndorsing(true)
    const prev = endorsed
    const prevCount = endorseCount
    setEndorsed(!prev)
    setEndorseCount((c) => (prev ? c - 1 : c + 1))
    try {
      const res = await fetch(`/api/committee-reports/${report.id}/endorse`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setEndorsed(data.endorsed)
      setEndorseCount(() => prevCount + (data.endorsed ? 1 : -1))
    } catch {
      setEndorsed(prev)
      setEndorseCount(prevCount)
    } finally {
      setEndorsing(false)
    }
  }, [currentUserId, endorsing, endorsed, endorseCount, report.id])

  const authorName = report.author?.display_name ?? report.author?.username ?? 'Anonymous'

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Back nav */}
      <div className="sticky top-14 z-10 border-b border-surface-300 bg-surface-100/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-11 flex items-center gap-3">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Reports
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm font-mono text-surface-500 truncate">{report.title}</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono border ${catStyle}`}>
              <Tag className="h-3 w-3" />
              {report.category}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono border ${rec.cls}`}>
              <RecIcon className="h-3 w-3" />
              {rec.label}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-mono font-bold text-white leading-snug">
            {report.title}
          </h1>

          {/* Summary */}
          <p className="text-base text-surface-300 font-mono leading-relaxed">
            {report.summary}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {report.view_count + 1} views
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {endorseCount} endorsements
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(report.published_at ?? report.created_at)}
            </span>
          </div>
        </motion.div>

        {/* Author */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Avatar
            src={report.author?.avatar_url}
            fallback={authorName}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profile/${report.author?.username ?? ''}`}
                className="font-mono font-semibold text-white hover:text-for-300 transition-colors text-sm"
              >
                {authorName}
              </Link>
              {report.author?.role && report.author.role !== 'user' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gold/10 text-gold border border-gold/30">
                  {report.author.role}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              @{report.author?.username ?? 'unknown'} · published {relTime(report.published_at ?? report.created_at)}
            </p>
          </div>
        </motion.div>

        {/* Topic link */}
        {report.topic_id && report.topic_statement && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-for-500/5 border border-for-500/20"
          >
            <FileText className="h-4 w-4 text-for-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-mono text-for-400 mb-1">Filed under topic</p>
              <Link
                href={`/topics/${report.topic_id}`}
                className="text-sm font-mono text-surface-200 hover:text-white transition-colors line-clamp-2"
              >
                {report.topic_statement}
                <ExternalLink className="h-3 w-3 inline ml-1.5 text-surface-500" />
              </Link>
            </div>
          </motion.div>
        )}

        {/* Recommendation banner */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className={`flex items-center gap-3 p-4 rounded-xl border ${rec.banner}`}
        >
          <RecIcon className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-mono font-semibold">{rec.label}</p>
            <p className="text-xs font-mono opacity-70 mt-0.5">Formal committee position issued with this report</p>
          </div>
        </motion.div>

        {/* Full content */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
        >
          <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-4">
            Full Report
          </h2>
          <div className="prose prose-invert prose-sm max-w-none">
            {report.content.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-surface-200 font-mono text-sm leading-relaxed mb-4 last:mb-0">
                {paragraph.split('\n').map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < paragraph.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </motion.div>

        {/* Tags */}
        {report.tags && report.tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.15 }}
            className="flex items-center gap-2 flex-wrap"
          >
            {report.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-mono bg-surface-200 text-surface-400 border border-surface-300"
              >
                #{tag}
              </span>
            ))}
          </motion.div>
        )}

        {/* Action bar */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.18 }}
          className="flex items-center gap-3 pt-2"
        >
          {currentUserId ? (
            <button
              onClick={handleEndorse}
              disabled={endorsing}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all duration-150 ${
                endorsed
                  ? 'bg-for-500 text-white hover:bg-for-600'
                  : 'bg-surface-200 text-surface-300 hover:bg-surface-300 hover:text-white border border-surface-400/30'
              } disabled:opacity-60`}
            >
              <ThumbsUp className="h-4 w-4" />
              {endorsed ? 'Endorsed' : 'Endorse'}
              <span className="ml-0.5 text-xs opacity-80">({endorseCount})</span>
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors border border-surface-400/30"
            >
              <ThumbsUp className="h-4 w-4" />
              Endorse ({endorseCount})
            </Link>
          )}

          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 transition-colors border border-surface-400/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {report.hearing_id && (
            <Link
              href={`/hearings/${report.hearing_id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono text-for-400 hover:text-white bg-for-500/10 hover:bg-for-500/20 transition-colors border border-for-500/30"
            >
              <FileText className="h-4 w-4" />
              View Hearing
            </Link>
          )}
        </motion.div>

        {/* Related links */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="rounded-xl bg-surface-100 border border-surface-300 p-4"
        >
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">More from this session</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: '/hearings', label: 'Hearings' },
              { href: '/motions', label: 'Motions' },
              { href: '/tribunal', label: 'Tribunal' },
              { href: '/grand-council', label: 'Grand Council' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-2 rounded-lg text-xs font-mono text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 transition-colors text-center border border-surface-300"
              >
                {label}
              </Link>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
