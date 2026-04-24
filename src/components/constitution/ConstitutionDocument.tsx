'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
  Gavel,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Users,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConstitutionLaw {
  id: string
  topic_id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

export interface ConstitutionArticle {
  ordinal: number
  romanNumeral: string
  category: string
  laws: ConstitutionLaw[]
  icon: string
  color: string
  bg: string
  border: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
  let result = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i]
      n -= vals[i]
    }
  }
  return result
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fmtVotes(n: number | null): string {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
               'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

// ─── Section number (e.g. §1.3) ───────────────────────────────────────────────

function SectionNumber({ article, section }: { article: number; section: number }) {
  return (
    <span className="font-mono text-[10px] text-surface-500 tabular-nums select-none flex-shrink-0 pt-0.5">
      §{article}.{section}
    </span>
  )
}

// ─── Vote breakdown bar ────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  const againstPct = 100 - bluePct
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] font-mono text-for-400 tabular-nums">{Math.round(bluePct)}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300 min-w-[40px]">
        <div
          className="h-full rounded-full bg-for-500 transition-all duration-700"
          style={{ width: `${bluePct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 tabular-nums">{Math.round(againstPct)}%</span>
    </div>
  )
}

// ─── Single law section ────────────────────────────────────────────────────────

function LawSection({
  law,
  articleIndex,
  sectionIndex,
}: {
  law: ConstitutionLaw
  articleIndex: number
  sectionIndex: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasBody = !!law.full_statement

  return (
    <div className="group relative">
      <div className="flex gap-3 py-3 px-4 rounded-xl hover:bg-surface-200/50 transition-colors">
        {/* Section number */}
        <SectionNumber article={articleIndex} section={sectionIndex} />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Statement */}
          <p className="text-sm text-white leading-snug font-medium">
            {law.statement}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* Vote breakdown */}
            {law.blue_pct !== null && (
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
                <VoteBar bluePct={law.blue_pct} />
                <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
              </div>
            )}

            {/* Vote count */}
            {law.total_votes ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Users className="h-3 w-3" />
                {fmtVotes(law.total_votes)}
              </span>
            ) : null}

            {/* Date */}
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {formatDate(law.established_at)}
            </span>
          </div>

          {/* Full statement */}
          {hasBody && (
            <>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Collapse rationale
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Read full rationale
                  </>
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-surface-500 leading-relaxed pt-1 border-t border-surface-300 mt-1">
                      {law.full_statement}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Link to topic */}
        <Link
          href={`/topic/${law.topic_id}`}
          className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300 text-surface-500 hover:bg-surface-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="View topic"
          aria-label="View topic"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ─── Article ───────────────────────────────────────────────────────────────────

function Article({
  article,
  defaultOpen,
}: {
  article: ConstitutionArticle
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: article.ordinal * 0.05 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        article.border,
        article.bg
      )}
      aria-labelledby={`article-${article.ordinal}-heading`}
    >
      {/* Article header */}
      <button
        id={`article-${article.ordinal}-heading`}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-200/30 transition-colors"
        aria-expanded={open}
      >
        {/* Icon */}
        <span className="text-xl flex-shrink-0 select-none" aria-hidden>
          {article.icon}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={cn('font-mono text-xs font-bold uppercase tracking-widest', article.color)}>
              Article {ROMAN[article.ordinal - 1] ?? toRoman(article.ordinal)}
            </span>
            <h2 className="font-mono text-base font-bold text-white truncate">
              {article.category}
            </h2>
          </div>
          <p className="text-xs font-mono text-surface-500 mt-0.5">
            {article.laws.length} {article.laws.length === 1 ? 'law' : 'laws'} established
          </p>
        </div>

        {/* Chevron */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border transition-colors',
          open ? 'bg-surface-300 border-surface-400 text-white' : 'bg-surface-200 border-surface-300 text-surface-500'
        )}>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Laws */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/50 divide-y divide-surface-300/30">
              {article.laws.map((law, idx) => (
                <LawSection
                  key={law.id}
                  law={law}
                  articleIndex={article.ordinal}
                  sectionIndex={idx + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ─── Share button ──────────────────────────────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
        copied
          ? 'bg-emerald/10 border-emerald/30 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
      )}
      aria-label="Copy link to constitution"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </>
      )}
    </button>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ConstitutionDocumentProps {
  articles: ConstitutionArticle[]
  totalLaws: number
  totalVotes: number
  ratifiedAt: string | null
  lastAmendedAt: string | null
}

export function ConstitutionDocument({
  articles,
  totalLaws,
  totalVotes,
  ratifiedAt,
  lastAmendedAt,
}: ConstitutionDocumentProps) {
  const [expandAll, setExpandAll] = useState(false)

  return (
    <div className="space-y-6">
      {/* ── Document header ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-gold/5 px-6 py-6 text-center space-y-3">
        {/* Seal icon */}
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full border-2 border-gold/40 bg-gold/10">
            <BookOpen className="h-6 w-6 text-gold" />
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/60 mb-1">
            We the People of the Lobby
          </p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-white">
            The Civic Constitution
          </h1>
          <p className="font-mono text-xs text-surface-500 mt-2 max-w-lg mx-auto leading-relaxed">
            A living document of consensus laws established through democratic vote. Every law
            here was debated, contested, and ratified by the community.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 border-t border-gold/10">
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-gold tabular-nums">{totalLaws}</p>
            <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Laws</p>
          </div>
          <div className="h-6 w-px bg-surface-400 hidden sm:block" />
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-for-400 tabular-nums">
              {totalVotes >= 1_000_000
                ? (totalVotes / 1_000_000).toFixed(1) + 'M'
                : totalVotes >= 1_000
                ? (totalVotes / 1_000).toFixed(1) + 'K'
                : totalVotes.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Votes Cast</p>
          </div>
          <div className="h-6 w-px bg-surface-400 hidden sm:block" />
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-emerald tabular-nums">{articles.length}</p>
            <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Articles</p>
          </div>
          {lastAmendedAt && (
            <>
              <div className="h-6 w-px bg-surface-400 hidden sm:block" />
              <div className="text-center">
                <p className="font-mono text-xs font-semibold text-surface-400">
                  {new Date(lastAmendedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Last amended</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Preamble ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 px-6 py-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Gavel className="h-4 w-4 text-gold" />
          <h2 className="font-mono text-xs font-bold text-gold uppercase tracking-widest">Preamble</h2>
        </div>
        <p className="text-sm text-surface-500 leading-relaxed italic font-mono">
          &ldquo;We, the citizens of the Lobby, in order to form a more perfect consensus, establish
          civic justice, ensure democratic deliberation, promote the general understanding, and secure
          the blessings of collective wisdom to ourselves and our community, do ordain and establish
          this Constitution of the Lobby Market.&rdquo;
        </p>
        <p className="text-xs text-surface-600 font-mono">
          Each law below was proposed by community members, debated in open forum, and ratified
          when it achieved supermajority consensus. Laws may be revised through petition and
          renewed community vote.
        </p>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setExpandAll((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          {expandAll ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse all
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Expand all
            </>
          )}
        </button>
        <ShareButton />
      </div>

      {/* ── Articles ─────────────────────────────────────────────────── */}
      {articles.length === 0 ? (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 px-6 py-16 text-center">
          <BookOpen className="h-10 w-10 text-surface-500 mx-auto mb-3" />
          <p className="font-mono text-sm font-semibold text-white">No laws established yet</p>
          <p className="font-mono text-xs text-surface-500 mt-1 max-w-xs mx-auto">
            The Constitution will populate as topics reach consensus and become law.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
          >
            Vote on active topics
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <Article
              key={article.category}
              article={article}
              defaultOpen={expandAll || article.ordinal <= 2}
            />
          ))}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="text-center pt-4 pb-8 space-y-1">
        <p className="font-mono text-[10px] text-surface-600 uppercase tracking-widest">
          Lobby Market · Democratic Consensus Engine
        </p>
        {ratifiedAt && (
          <p className="font-mono text-[10px] text-surface-600">
            First law ratified {formatDate(ratifiedAt)}
          </p>
        )}
      </div>
    </div>
  )
}
