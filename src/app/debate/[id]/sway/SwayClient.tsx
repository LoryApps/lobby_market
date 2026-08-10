'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SwayArcResponse, SwayPoint } from '@/app/api/debates/[id]/sway/route'

const CHART_W = 400
const CHART_H = 104
const MID_Y = CHART_H / 2

interface Props {
  debateId: string
  debateTitle?: string | null
}

function yFromPct(pct: number): number {
  return ((100 - pct) / 100) * CHART_H
}

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ''
  const segs: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(i - 1, 0)]
    const b = pts[i]
    const c = pts[i + 1]
    const dd = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = b.x + (c.x - a.x) / 6
    const cp1y = b.y + (c.y - a.y) / 6
    const cp2x = c.x - (dd.x - b.x) / 6
    const cp2y = c.y - (dd.y - b.y) / 6
    segs.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${c.x.toFixed(2)} ${c.y.toFixed(2)}`
    )
  }
  return segs.join(' ')
}

function SwayChart({ points }: { points: SwayPoint[] }) {
  const n = points.length
  const coords = points.map((_, i) => ({
    x: n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W,
    y: yFromPct(points[i].blue_pct),
  }))

  const linePath = smoothPath(coords)
  const first = coords[0] ?? { x: 0, y: MID_Y }
  const last = coords[coords.length - 1] ?? { x: CHART_W, y: MID_Y }

  const blueArea = linePath
    ? `${linePath} L ${last.x.toFixed(2)} 0 L ${first.x.toFixed(2)} 0 Z`
    : ''
  const redArea = linePath
    ? `${linePath} L ${last.x.toFixed(2)} ${CHART_H} L ${first.x.toFixed(2)} ${CHART_H} Z`
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-xl bg-surface-100 border border-surface-300/40 p-4"
    >
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-[10px] font-mono font-bold text-for-400">FOR ▲</span>
        <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
          Opinion Arc
        </span>
        <span className="text-[10px] font-mono font-bold text-against-400">▼ AGAINST</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H + 28}`}
        className="w-full"
        style={{ height: 160, overflow: 'visible' }}
      >
        <defs>
          <clipPath id="sway-blue-clip">
            <rect x={0} y={0} width={CHART_W} height={MID_Y} />
          </clipPath>
          <clipPath id="sway-red-clip">
            <rect x={0} y={MID_Y} width={CHART_W} height={MID_Y} />
          </clipPath>
          <linearGradient id="sway-blue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="sway-red-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgb(239,68,68)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(239,68,68)" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {/* Reference lines */}
        <line
          x1={0}
          y1={MID_Y}
          x2={CHART_W}
          y2={MID_Y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
        <text
          x={CHART_W - 1}
          y={MID_Y - 3}
          textAnchor="end"
          fontSize={8}
          fill="rgba(255,255,255,0.22)"
          fontFamily="monospace"
        >
          50%
        </text>

        {/* Fill areas */}
        <path d={blueArea} fill="url(#sway-blue-grad)" clipPath="url(#sway-blue-clip)" />
        <path d={redArea} fill="url(#sway-red-grad)" clipPath="url(#sway-red-clip)" />

        {/* Arc line */}
        <path
          d={linePath}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Checkpoint dots + labels */}
        {coords.map((c, i) => {
          const pt = points[i]
          const isFor = pt.blue_pct >= 50
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.3 }}
            >
              <line
                x1={c.x}
                y1={0}
                x2={c.x}
                y2={CHART_H}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
              <circle
                cx={c.x}
                cy={c.y}
                r={5}
                fill={isFor ? 'rgb(96,165,250)' : 'rgb(248,113,113)'}
                stroke="rgb(15,23,42)"
                strokeWidth={2}
              />
              <text
                x={c.x}
                y={c.y - 10}
                textAnchor="middle"
                fontSize={10}
                fill={isFor ? 'rgb(147,197,253)' : 'rgb(252,165,165)'}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {pt.blue_pct}%
              </text>
              <text
                x={c.x}
                y={CHART_H + 17}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(148,163,184,0.7)"
                fontFamily="monospace"
              >
                {pt.label}
              </text>
            </motion.g>
          )
        })}
      </svg>
    </motion.div>
  )
}

function CheckpointCard({ point, index }: { point: SwayPoint; index: number }) {
  const isFor = point.blue_pct >= 50
  const margin = Math.abs(point.blue_pct - 50)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className="rounded-xl bg-surface-100/60 border border-surface-300/40 p-3.5"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-mono font-bold text-white">{point.label}</span>
        <div className="flex items-center gap-1.5">
          {margin > 5 ? (
            isFor ? (
              <TrendingUp className="h-3 w-3 text-for-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-against-400" />
            )
          ) : (
            <Minus className="h-3 w-3 text-surface-500" />
          )}
          <span
            className={cn(
              'text-[10px] font-mono font-bold',
              margin <= 5
                ? 'text-surface-500'
                : isFor
                ? 'text-for-400'
                : 'text-against-400',
            )}
          >
            {margin <= 5 ? 'Even' : isFor ? `+${margin}% FOR` : `+${margin}% AGAINST`}
          </span>
        </div>
      </div>

      {/* Split bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-200">
        <motion.div
          className="bg-for-500 h-full rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${point.blue_pct}%` }}
          transition={{ delay: 0.15 + index * 0.08, duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 h-full rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${point.red_pct}%` }}
          transition={{ delay: 0.15 + index * 0.08, duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-[10px] font-mono">
        <span className="text-for-400/80">
          {point.blue_pct}%
          <span className="text-surface-600 ml-1">
            ({point.blue_votes.toLocaleString()} votes)
          </span>
        </span>
        <span className="text-against-400/80">
          <span className="text-surface-600 mr-1">
            ({point.red_votes.toLocaleString()} votes)
          </span>
          {point.red_pct}%
        </span>
      </div>
    </motion.div>
  )
}

export function SwayClient({ debateId, debateTitle }: Props) {
  const [data, setData] = useState<SwayArcResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/debates/${debateId}/sway`)
      .then((r) => r.json())
      .then((json: SwayArcResponse & { error?: string }) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false))
  }, [debateId])

  const netSwing = data ? data.final_blue - 50 : null
  const checkpointPoints = data?.points.slice(1) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">
        {/* Back */}
        <Link
          href={`/debate/${debateId}/explore`}
          className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Debate Hub
        </Link>

        {/* Header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-emerald" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald">
              Opinion Sway Arc
            </span>
          </div>
          {debateTitle && (
            <h1 className="text-lg md:text-xl font-mono font-bold text-white leading-snug">
              {debateTitle}
            </h1>
          )}
          <p className="text-xs text-surface-500 mt-1">
            How audience opinion shifted round by round
          </p>
          {data && (
            <p className="flex items-center gap-1.5 mt-3 text-[11px] font-mono text-surface-600">
              <Users className="h-3 w-3" />
              {data.total_votes.toLocaleString()} sway{' '}
              {data.total_votes === 1 ? 'vote' : 'votes'} cast
            </p>
          )}
        </div>

        {/* Arc visualization */}
        {loading ? (
          <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4">
            <Skeleton className="h-[160px] w-full rounded-lg" />
          </div>
        ) : fetchError ? (
          <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-4 text-sm text-against-400">
            {fetchError}
          </div>
        ) : data ? (
          <SwayChart points={data.points} />
        ) : null}

        {/* No data notice */}
        {!loading && !fetchError && data && !data.has_data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-surface-100/40 border border-surface-300/30 p-4 text-center"
          >
            <p className="text-xs font-mono text-surface-500">
              Not enough sway votes yet.
            </p>
            <p className="text-[11px] text-surface-600 mt-1">
              Sway votes are cast at checkpoints during live debates.
            </p>
          </motion.div>
        )}

        {/* Round breakdown */}
        {!loading && data && checkpointPoints.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-surface-500 px-1">
              Round Breakdown
            </h2>
            {checkpointPoints.map((pt, i) => (
              <CheckpointCard key={pt.label} point={pt} index={i} />
            ))}
          </div>
        )}

        {/* Net swing summary */}
        {!loading && data && data.has_data && netSwing !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              'rounded-xl border p-4',
              netSwing > 2
                ? 'bg-for-500/10 border-for-500/25'
                : netSwing < -2
                ? 'bg-against-500/10 border-against-500/25'
                : 'bg-surface-100 border-surface-300/40',
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              {netSwing > 2 ? (
                <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
              ) : netSwing < -2 ? (
                <TrendingDown className="h-4 w-4 text-against-400 flex-shrink-0" />
              ) : (
                <Minus className="h-4 w-4 text-surface-500 flex-shrink-0" />
              )}
              <span className="text-xs font-mono font-bold text-white">Net Opinion Swing</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] font-mono text-surface-600 mb-0.5">Started</p>
                <p className="text-xl font-mono font-black text-white">50%</p>
                <p className="text-[10px] text-surface-600">FOR</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span
                  className={cn(
                    'text-sm font-mono font-bold px-2.5 py-1 rounded-lg',
                    netSwing > 2
                      ? 'text-for-300 bg-for-500/15'
                      : netSwing < -2
                      ? 'text-against-300 bg-against-500/15'
                      : 'text-surface-400 bg-surface-200',
                  )}
                >
                  {netSwing > 0 ? `+${netSwing}%` : `${netSwing}%`}
                </span>
                <span className="text-[10px] text-surface-600 mt-1.5">shift</span>
              </div>
              <div>
                <p className="text-[10px] font-mono text-surface-600 mb-0.5">Ended</p>
                <p
                  className={cn(
                    'text-xl font-mono font-black',
                    data.final_blue > 50 ? 'text-for-300' : data.final_blue < 50 ? 'text-against-300' : 'text-white',
                  )}
                >
                  {data.final_blue}%
                </p>
                <p className="text-[10px] text-surface-600">FOR</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          <Link
            href={`/debate/${debateId}/scorecard`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
          >
            Scorecard
            <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/debate/${debateId}/verdict`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            Verdict
            <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/debate/${debateId}/recap`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            Recap
            <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/debate/${debateId}/performance`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            Performance
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
