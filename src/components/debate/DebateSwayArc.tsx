'use client'

/**
 * DebateSwayArc — per-checkpoint audience opinion arc on the recap page.
 *
 * Shows how the crowd voted FOR vs AGAINST at each of the 3 live checkpoints,
 * rendered as two animated SVG lines (blue = FOR, red = AGAINST) running
 * left-to-right from "Start" through up to three checkpoints.
 *
 * Falls back silently when fewer than 2 sway votes exist, which is normal
 * for low-attendance or dev debates.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SwayArcResponse, SwayPoint } from '@/app/api/debates/[id]/sway/route'

// ─── SVG layout constants ──────────────────────────────────────────────────────

const W = 300
const H = 110
const PAD_L = 36
const PAD_R = 8
const PAD_T = 12
const PAD_B = 24
const CW = W - PAD_L - PAD_R   // chart width
const CH = H - PAD_T - PAD_B   // chart height

function yOf(pct: number): number {
  return PAD_T + CH * (1 - pct / 100)
}

function xOf(i: number, n: number): number {
  if (n <= 1) return PAD_L + CW / 2
  return PAD_L + (i / (n - 1)) * CW
}

// Build a smooth SVG path (cardinal spline-ish, using cubic bezier with
// horizontal control points) for a cleaner arc look.
function buildPath(coords: { x: number; y: number }[]): string {
  if (coords.length < 2) return ''
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
  }
  return d
}

// ─── Animated path ─────────────────────────────────────────────────────────────

interface AnimatedPathProps {
  d: string
  color: string
  delay?: number
}

function AnimatedPath({ d, color, delay = 0 }: AnimatedPathProps) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ pathLength: { duration: 0.9, delay, ease: 'easeOut' }, opacity: { duration: 0.2, delay } }}
    />
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface DebateSwayArcProps {
  debateId: string
}

export function DebateSwayArc({ debateId }: DebateSwayArcProps) {
  const [data, setData] = useState<SwayArcResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/debates/${debateId}/sway`)
      .then((r) => r.json())
      .then((d: SwayArcResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debateId])

  if (loading || !data || !data.has_data || data.points.length < 2) return null

  const pts: SwayPoint[] = data.points
  const n = pts.length

  const blueCoords = pts.map((p, i) => ({ x: xOf(i, n), y: yOf(p.blue_pct) }))
  const redCoords  = pts.map((p, i) => ({ x: xOf(i, n), y: yOf(p.red_pct) }))

  const bluePath = buildPath(blueCoords)
  const redPath  = buildPath(redCoords)

  const yGuides = [75, 50, 25]

  return (
    <div className="bg-surface-100 rounded-xl p-5 border border-surface-200/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple" aria-hidden="true" />
        <p className="text-sm font-semibold text-white">Audience Opinion Arc</p>
        <span className="ml-auto text-[11px] font-mono text-surface-500">
          {data.total_votes} sway vote{data.total_votes !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-for-500 inline-block" />
          <span className="text-[11px] font-mono text-for-400">FOR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-against-500 inline-block" />
          <span className="text-[11px] font-mono text-against-400">AGAINST</span>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        aria-label="Audience sway arc across debate checkpoints"
        role="img"
      >
        {/* Y-axis guide lines */}
        {yGuides.map((pct) => {
          const y = yOf(pct)
          const isMid = pct === 50
          return (
            <g key={pct}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke={isMid ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'}
                strokeWidth={isMid ? 1.5 : 1}
                strokeDasharray={isMid ? undefined : '3 4'}
              />
              <text
                x={PAD_L - 4}
                y={y + 3.5}
                textAnchor="end"
                fontSize={7.5}
                fill="rgba(255,255,255,0.28)"
                fontFamily="monospace"
              >
                {pct}%
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {pts.map((p, i) => (
          <text
            key={p.label}
            x={xOf(i, n)}
            y={H - 4}
            textAnchor="middle"
            fontSize={7.5}
            fill="rgba(255,255,255,0.32)"
            fontFamily="monospace"
          >
            {p.label}
          </text>
        ))}

        {/* Animated lines */}
        <AnimatedPath d={bluePath} color="#3b82f6" delay={0.15} />
        <AnimatedPath d={redPath}  color="#ef4444" delay={0.25} />

        {/* Dots on blue line */}
        {blueCoords.map((pt, i) => (
          <motion.circle
            key={`bd${i}`}
            cx={pt.x}
            cy={pt.y}
            r={3.5}
            fill="#3b82f6"
            stroke="#0f172a"
            strokeWidth={1.5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8 + i * 0.06, duration: 0.25 }}
          />
        ))}

        {/* Dots on red line */}
        {redCoords.map((pt, i) => (
          <motion.circle
            key={`rd${i}`}
            cx={pt.x}
            cy={pt.y}
            r={3.5}
            fill="#ef4444"
            stroke="#0f172a"
            strokeWidth={1.5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.85 + i * 0.06, duration: 0.25 }}
          />
        ))}

        {/* Percentage labels above blue dots (skip start) */}
        {pts.map((p, i) => {
          if (i === 0) return null
          const x = xOf(i, n)
          const y = yOf(p.blue_pct)
          const labelY = y > PAD_T + 14 ? y - 8 : y + 14
          return (
            <motion.text
              key={`lbl${i}`}
              x={x}
              y={labelY}
              textAnchor="middle"
              fontSize={8}
              fill="#93c5fd"
              fontFamily="monospace"
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 + i * 0.08 }}
            >
              {p.blue_pct}%
            </motion.text>
          )
        })}
      </svg>

      {/* Footer: final sway */}
      <div className="mt-3 pt-3 border-t border-surface-200/20 flex items-center justify-between">
        <span className={cn(
          'text-[11px] font-mono font-bold',
          data.final_blue >= data.final_red ? 'text-for-400' : 'text-surface-500'
        )}>
          FOR {data.final_blue}%
        </span>
        <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
          Final sway
        </span>
        <span className={cn(
          'text-[11px] font-mono font-bold',
          data.final_red > data.final_blue ? 'text-against-400' : 'text-surface-500'
        )}>
          AGAINST {data.final_red}%
        </span>
      </div>
    </div>
  )
}
