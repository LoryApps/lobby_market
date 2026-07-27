'use client'

/**
 * /exchange/[id]/quality — Market Quality Report
 *
 * A comprehensive breakdown of a civic prediction market's health and
 * reliability across four dimensions:
 *
 *   1. Resolution Clarity   — Is the question well-defined? Does the wiki exist?
 *   2. Trader Diversity     — Are enough distinct voices participating?
 *   3. Argument Quality     — Is the debate balanced and substantive?
 *   4. Price Efficiency     — Is the market price a reliable consensus signal?
 *
 * Each dimension is scored 0–100. The composite Quality Score is a weighted
 * average, displayed as a ring gauge and grade letter (A+–F).
 *
 * No AI calls needed — all scores are derived from structural market data
 * passed in from the server component.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  FileText,
  Gavel,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QualityDimension {
  key: string
  label: string
  score: number           // 0–100
  grade: string           // A+, A, B, C, D, F
  description: string
  findings: Finding[]
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}

interface Finding {
  type: 'positive' | 'warning' | 'negative' | 'neutral'
  text: string
}

interface Props {
  id: string
  statement: string
  category: string | null
  status: string
  currentPrice: number
  totalVotes: number
  blueVotes: number
  argCount: number
  forArgCount: number
  againstArgCount: number
  uniqueVoters: number
  wikiLength: number
  debateCount: number
  createdAt: string
}

// ─── Scoring logic ────────────────────────────────────────────────────────────

function toGrade(score: number): string {
  if (score >= 93) return 'A+'
  if (score >= 87) return 'A'
  if (score >= 80) return 'A−'
  if (score >= 73) return 'B+'
  if (score >= 67) return 'B'
  if (score >= 60) return 'B−'
  if (score >= 53) return 'C+'
  if (score >= 47) return 'C'
  if (score >= 40) return 'C−'
  if (score >= 30) return 'D'
  return 'F'
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald'
  if (grade.startsWith('B')) return 'text-for-300'
  if (grade.startsWith('C')) return 'text-gold'
  if (grade.startsWith('D')) return 'text-against-300'
  return 'text-against-400'
}

function scoreResolutionClarity(
  statement: string,
  wikiLength: number,
  status: string,
): { score: number; findings: Finding[] } {
  const findings: Finding[] = []
  let score = 40

  // Statement length (clear question = longer, more precise)
  const sLen = statement.trim().length
  if (sLen >= 60) {
    score += 20
    findings.push({ type: 'positive', text: 'Question is well-specified and detailed' })
  } else if (sLen >= 30) {
    score += 10
    findings.push({ type: 'neutral', text: 'Question is adequately specified' })
  } else {
    findings.push({ type: 'warning', text: 'Short question — resolution criteria may be ambiguous' })
  }

  // Question mark (proper question format)
  if (statement.trim().endsWith('?')) {
    score += 5
    findings.push({ type: 'positive', text: 'Properly formatted as a yes/no question' })
  }

  // Wiki exists
  if (wikiLength > 500) {
    score += 25
    findings.push({ type: 'positive', text: `Wiki article provides ${(wikiLength / 1000).toFixed(1)}k chars of context` })
  } else if (wikiLength > 100) {
    score += 12
    findings.push({ type: 'neutral', text: 'Wiki article exists but could be more detailed' })
  } else {
    findings.push({ type: 'warning', text: 'No community wiki — resolution criteria may be unclear' })
  }

  // Status
  if (status === 'law') {
    score += 10
    findings.push({ type: 'positive', text: 'Resolved as LAW — resolution criteria were met' })
  } else if (status === 'failed') {
    score += 5
    findings.push({ type: 'neutral', text: 'Resolved as failed — clear outcome reached' })
  }

  return { score: Math.min(100, score), findings }
}

function scoreTraderDiversity(
  uniqueVoters: number,
  totalVotes: number,
  blueVotes: number,
): { score: number; findings: Finding[] } {
  const findings: Finding[] = []
  let score = 30

  // Unique voter count
  if (uniqueVoters >= 100) {
    score += 30
    findings.push({ type: 'positive', text: `${uniqueVoters.toLocaleString()} unique traders — deep market` })
  } else if (uniqueVoters >= 25) {
    score += 18
    findings.push({ type: 'positive', text: `${uniqueVoters.toLocaleString()} unique traders — moderate participation` })
  } else if (uniqueVoters >= 10) {
    score += 8
    findings.push({ type: 'warning', text: `Only ${uniqueVoters} unique traders — thin market` })
  } else {
    findings.push({ type: 'negative', text: `Fewer than 10 traders — very thin market` })
  }

  // Opinion balance (avoid extreme unanimity)
  const forPct = totalVotes > 0 ? (blueVotes / totalVotes) * 100 : 50
  const balance = 100 - Math.abs(forPct - 50) * 2  // 100 at 50/50, 0 at 100/0
  if (balance >= 60) {
    score += 30
    findings.push({ type: 'positive', text: `Balanced opinion split — ${Math.round(forPct)}% FOR / ${Math.round(100 - forPct)}% AGAINST` })
  } else if (balance >= 30) {
    score += 15
    findings.push({ type: 'neutral', text: `Moderate consensus — ${Math.round(forPct)}% FOR` })
  } else {
    score += 5
    findings.push({ type: 'warning', text: `Near-unanimous — ${Math.round(forPct)}% FOR. Limited opposing views.` })
  }

  // Volume
  if (totalVotes >= 500) {
    score += 10
    findings.push({ type: 'positive', text: `High volume — ${totalVotes.toLocaleString()} total votes` })
  } else if (totalVotes >= 50) {
    score += 5
    findings.push({ type: 'neutral', text: `Moderate volume — ${totalVotes.toLocaleString()} votes` })
  } else {
    findings.push({ type: 'warning', text: `Low volume — only ${totalVotes} votes cast` })
  }

  return { score: Math.min(100, score), findings }
}

function scoreArgumentQuality(
  argCount: number,
  forArgCount: number,
  againstArgCount: number,
  debateCount: number,
): { score: number; findings: Finding[] } {
  const findings: Finding[] = []
  let score = 20

  // Total argument count
  if (argCount >= 20) {
    score += 30
    findings.push({ type: 'positive', text: `${argCount} arguments submitted — rich debate record` })
  } else if (argCount >= 8) {
    score += 18
    findings.push({ type: 'positive', text: `${argCount} arguments — substantive debate` })
  } else if (argCount >= 3) {
    score += 8
    findings.push({ type: 'neutral', text: `${argCount} arguments — limited debate so far` })
  } else {
    findings.push({ type: 'warning', text: 'Fewer than 3 arguments — almost no debate' })
  }

  // Argument balance (for vs against)
  if (argCount > 0) {
    const smallerSide = Math.min(forArgCount, againstArgCount)
    const largerSide  = Math.max(forArgCount, againstArgCount)
    const balance = largerSide > 0 ? smallerSide / largerSide : 0
    if (balance >= 0.6) {
      score += 30
      findings.push({ type: 'positive', text: `Balanced: ${forArgCount} FOR vs ${againstArgCount} AGAINST arguments` })
    } else if (balance >= 0.3) {
      score += 15
      findings.push({ type: 'neutral', text: `Somewhat balanced: ${forArgCount} FOR vs ${againstArgCount} AGAINST` })
    } else {
      score += 5
      findings.push({ type: 'warning', text: `Unbalanced debate: ${forArgCount} FOR vs ${againstArgCount} AGAINST` })
    }
  }

  // Debate count (structured formal debates)
  if (debateCount >= 3) {
    score += 20
    findings.push({ type: 'positive', text: `${debateCount} formal debates scheduled or completed` })
  } else if (debateCount >= 1) {
    score += 10
    findings.push({ type: 'neutral', text: `${debateCount} formal debate — structured discourse exists` })
  } else {
    findings.push({ type: 'neutral', text: 'No formal debates yet — arguments only' })
  }

  return { score: Math.min(100, score), findings }
}

function scorePriceEfficiency(
  currentPrice: number,
  totalVotes: number,
  uniqueVoters: number,
  status: string,
): { score: number; findings: Finding[] } {
  const findings: Finding[] = []
  let score = 30

  // Price is informative (not exactly 50 when there's volume)
  const priceDeviation = Math.abs(currentPrice - 50)
  if (totalVotes > 10 && priceDeviation > 5) {
    score += 20
    findings.push({ type: 'positive', text: `Price at ${currentPrice}¢ reflects genuine consensus signal` })
  } else if (totalVotes > 10 && priceDeviation <= 5) {
    score += 10
    findings.push({ type: 'neutral', text: `Price near 50¢ — community is genuinely divided` })
  } else {
    findings.push({ type: 'warning', text: 'Insufficient votes to establish reliable price' })
  }

  // Ratio of unique voters to total votes (proxy for conviction)
  if (uniqueVoters > 0 && totalVotes > 0) {
    const conviction = totalVotes / uniqueVoters
    if (conviction >= 1.0) {
      score += 20
      findings.push({ type: 'positive', text: 'High trader participation relative to vote volume' })
    } else {
      score += 10
      findings.push({ type: 'neutral', text: 'Normal participation rate' })
    }
  }

  // Resolved markets have proven efficient
  if (status === 'law') {
    score += 30
    findings.push({ type: 'positive', text: 'Market resolved to LAW — price prediction was correct' })
  } else if (status === 'failed') {
    score += 20
    findings.push({ type: 'positive', text: 'Market resolved as failed — price reflected outcome' })
  } else if (status === 'voting') {
    score += 15
    findings.push({ type: 'positive', text: 'Market in voting phase — price is actively contested' })
  } else {
    score += 5
    findings.push({ type: 'neutral', text: 'Market still active — price continues to update' })
  }

  return { score: Math.min(100, score), findings }
}

// ─── Ring Gauge ───────────────────────────────────────────────────────────────

function RingGauge({ score, grade }: { score: number; grade: string }) {
  const R = 52
  const STROKE = 8
  const circumference = 2 * Math.PI * R
  const filled = (score / 100) * circumference
  const gColor = gradeColor(grade)

  const colorClass =
    score >= 80 ? 'text-emerald' :
    score >= 60 ? 'text-for-400' :
    score >= 40 ? 'text-gold' :
    'text-against-400'

  const strokeColor =
    score >= 80 ? '#34d399' :
    score >= 60 ? '#60a5fa' :
    score >= 40 ? '#f59e0b' :
    '#f87171'

  return (
    <div className="flex items-center justify-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          {/* Track */}
          <circle
            cx={64} cy={64} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />
          {/* Progress */}
          <motion.circle
            cx={64} cy={64} r={R}
            fill="none"
            stroke={strokeColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - filled }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('text-3xl font-bold font-mono', colorClass)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <motion.span
            className={cn('text-lg font-bold font-mono', gColor)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {grade}
          </motion.span>
        </div>
      </div>
    </div>
  )
}

// ─── Dimension Card ───────────────────────────────────────────────────────────

function DimensionCard({ dim, delay }: { dim: QualityDimension; delay: number }) {
  const gColor = gradeColor(dim.grade)

  const findingIcon = {
    positive: <CheckCircle2 className="w-3.5 h-3.5 text-for-400 flex-shrink-0 mt-0.5" />,
    warning:  <AlertTriangle className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />,
    negative: <XCircle className="w-3.5 h-3.5 text-against-400 flex-shrink-0 mt-0.5" />,
    neutral:  <Shield className="w-3.5 h-3.5 text-surface-500 flex-shrink-0 mt-0.5" />,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'rounded-2xl border p-5',
        dim.bg, dim.border,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', dim.bg)}>
            <dim.icon className={cn('w-4 h-4', dim.color)} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{dim.label}</p>
            <p className="text-xs text-surface-500">{dim.description}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className={cn('text-2xl font-bold font-mono', gColor)}>{dim.grade}</div>
          <div className="text-xs text-surface-500 font-mono">{dim.score}/100</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full h-1.5 bg-surface-300 rounded-full mb-3 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', dim.color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 0.8, delay: delay + 0.1, ease: 'easeOut' }}
          style={{
            background: dim.score >= 80
              ? '#34d399'
              : dim.score >= 60
                ? '#60a5fa'
                : dim.score >= 40
                  ? '#f59e0b'
                  : '#f87171',
          }}
        />
      </div>

      {/* Findings */}
      <div className="space-y-1.5">
        {dim.findings.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-surface-400">
            {findingIcon[f.type]}
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QualityClient({
  id,
  statement,
  category,
  status,
  currentPrice,
  totalVotes,
  blueVotes,
  argCount,
  forArgCount,
  againstArgCount,
  uniqueVoters,
  wikiLength,
  debateCount,
}: Props) {
  const dimensions = useMemo<QualityDimension[]>(() => {
    const rc = scoreResolutionClarity(statement, wikiLength, status)
    const td = scoreTraderDiversity(uniqueVoters, totalVotes, blueVotes)
    const aq = scoreArgumentQuality(argCount, forArgCount, againstArgCount, debateCount)
    const pe = scorePriceEfficiency(currentPrice, totalVotes, uniqueVoters, status)

    return [
      {
        key: 'resolution',
        label: 'Resolution Clarity',
        score: rc.score,
        grade: toGrade(rc.score),
        description: 'How well-defined is the question and resolution criteria?',
        findings: rc.findings,
        icon: FileText,
        color: 'text-for-400',
        bg: 'bg-for-500/5',
        border: 'border-for-500/20',
      },
      {
        key: 'diversity',
        label: 'Trader Diversity',
        score: td.score,
        grade: toGrade(td.score),
        description: 'Breadth and balance of trader participation',
        findings: td.findings,
        icon: Users,
        color: 'text-purple',
        bg: 'bg-purple/5',
        border: 'border-purple/20',
      },
      {
        key: 'arguments',
        label: 'Argument Quality',
        score: aq.score,
        grade: toGrade(aq.score),
        description: 'Substantiveness and balance of the underlying debate',
        findings: aq.findings,
        icon: MessageSquare,
        color: 'text-emerald',
        bg: 'bg-emerald/5',
        border: 'border-emerald/20',
      },
      {
        key: 'efficiency',
        label: 'Price Efficiency',
        score: pe.score,
        grade: toGrade(pe.score),
        description: 'How reliably does the price reflect true consensus?',
        findings: pe.findings,
        icon: TrendingUp,
        color: 'text-gold',
        bg: 'bg-gold/5',
        border: 'border-gold/20',
      },
    ]
  }, [
    statement, wikiLength, status, uniqueVoters, totalVotes, blueVotes,
    argCount, forArgCount, againstArgCount, debateCount, currentPrice,
  ])

  const composite = useMemo(() => {
    const weights = [0.3, 0.25, 0.25, 0.2]  // RC, TD, AQ, PE
    return Math.round(
      dimensions.reduce((sum, d, i) => sum + d.score * weights[i], 0)
    )
  }, [dimensions])

  const compositeGrade = toGrade(composite)
  const compositeColor = gradeColor(compositeGrade)

  const compositeLabel =
    composite >= 80 ? 'High Quality' :
    composite >= 60 ? 'Good Quality' :
    composite >= 40 ? 'Fair Quality' :
    'Low Quality'

  const compositeDescription =
    composite >= 80
      ? 'This market has clear resolution criteria, broad trader participation, substantive debate, and a reliable price signal. Suitable for confident position-taking.'
      : composite >= 60
        ? 'Solid market fundamentals. The price signal is informative, though some dimensions could be strengthened.'
        : composite >= 40
          ? 'Market quality is moderate. Trade with caution and look for improvements in weaker dimensions before sizing up.'
          : 'Low quality market. Thin participation, unclear resolution criteria, or unbalanced debate — approach with significant caution.'

  const isLaw    = status === 'law'
  const isFailed = status === 'failed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <div className="max-w-3xl mx-auto px-4 pt-4 pb-28">
        {/* Back link */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Market
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-white">Market Quality Report</h1>
            {category && (
              <Badge variant="outline" className="text-xs border-surface-400/50 text-surface-400">
                {category}
              </Badge>
            )}
            {isLaw && (
              <Badge className="bg-gold/20 text-gold border-gold/30 text-xs flex items-center gap-1">
                <Gavel className="w-3 h-3" /> LAW
              </Badge>
            )}
            {isFailed && (
              <Badge className="bg-against-500/10 text-against-300 border-against-500/30 text-xs">
                Failed
              </Badge>
            )}
          </div>
          <p className="text-sm text-surface-500 leading-snug line-clamp-2">{statement}</p>
        </div>

        {/* Composite score card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4"
        >
          <div className="flex items-center gap-6">
            <RingGauge score={composite} grade={compositeGrade} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={cn('w-4 h-4', compositeColor)} />
                <span className={cn('text-base font-bold', compositeColor)}>{compositeLabel}</span>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed mb-3">
                {compositeDescription}
              </p>
              <div className="flex flex-wrap gap-2">
                {dimensions.map(d => (
                  <div
                    key={d.key}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border',
                      d.bg, d.border,
                    )}
                  >
                    <span className={d.color}>{d.grade}</span>
                    <span className="text-surface-500">{d.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dimension cards */}
        <div className="space-y-3 mb-4">
          {dimensions.map((dim, i) => (
            <DimensionCard key={dim.key} dim={dim} delay={i * 0.08 + 0.2} />
          ))}
        </div>

        {/* Methodology note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4"
        >
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Methodology
          </p>
          <p className="text-xs text-surface-500 leading-relaxed">
            Quality scores are computed from structural market data — no AI inference required.
            Resolution Clarity (30%) weights statement length and wiki depth.
            Trader Diversity (25%) weights unique voter count and opinion balance.
            Argument Quality (25%) weights argument count, balance, and debate activity.
            Price Efficiency (20%) weights price informativeness and participation rate.
            Scores update in real time as the market evolves.
          </p>
        </motion.div>

        {/* Nav links */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `/exchange/${id}/swing`,       label: 'Swing Analysis',  sub: 'Major price moves',       icon: BarChart2 },
            { href: `/exchange/${id}/smart-money`, label: 'Smart Money',     sub: 'Who leads the market',    icon: Award },
            { href: `/exchange/${id}/arguments`,   label: 'Arguments',       sub: 'The underlying debate',   icon: MessageSquare },
            { href: `/exchange/${id}/scorecard`,   label: 'Scorecard',       sub: 'Market performance card', icon: Scale },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <link.icon className="w-4 h-4 text-surface-500 group-hover:text-for-300 transition-colors" />
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors">
                    {link.label}
                  </p>
                  <p className="text-xs text-surface-500">{link.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-for-300 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
