'use client'

/**
 * /orrery — The Civic Orrery
 *
 * A solar system–style interactive visualization of all active debates.
 * Each topic is a planet orbiting the Consensus Core.
 *
 * Encoding:
 *   Distance from center = polarization (far = near 50/50, close = strong consensus)
 *   Planet size          = total_votes (bigger = more contested)
 *   Color                = consensus side (blue = FOR majority, red = AGAINST, gray = balanced)
 *   Ring zone            = topic category (each category gets its own orbital band)
 *   Orbital speed        = inversely proportional to age (newer = faster orbit)
 *   Ring color           = category-coded accent
 *
 * Interaction:
 *   Hover = tooltip with topic statement + stats
 *   Click  = navigate to /topic/[id]
 *   Toggle = pause/resume animation
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Info,
  Loader2,
  Pause,
  Play,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { OrreryTopic } from '@/app/api/orrery/route'

// ─── Category orbital configuration ──────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#f59e0b',
  Politics: '#3b82f6',
  Technology: '#8b5cf6',
  Science: '#10b981',
  Environment: '#22c55e',
  Healthcare: '#ef4444',
  Education: '#f97316',
  Law: '#a78bfa',
  Culture: '#ec4899',
  'Foreign Policy': '#06b6d4',
  Social: '#84cc16',
  Defense: '#6b7280',
}

function getCategoryColor(category: string | null): string {
  if (!category) return '#52525b'
  return CATEGORY_COLORS[category] ?? '#52525b'
}

// ─── Topic planet computation ─────────────────────────────────────────────────

interface Planet {
  topic: OrreryTopic
  orbitRadius: number
  orbitSpeed: number   // radians/second
  startAngle: number
  size: number
  color: string
  ringColor: string
}

function buildPlanets(topics: OrreryTopic[], maxR: number): Planet[] {
  if (topics.length === 0) return []

  const maxVotes = Math.max(...topics.map((t) => t.total_votes), 1)

  // Group by category to assign orbit bands
  const categories = [...new Set(topics.map((t) => t.category ?? 'Other'))]
  const bandWidth = (maxR * 0.75 - maxR * 0.15) / Math.max(categories.length, 1)

  return topics.map((topic, i) => {
    const cat = topic.category ?? 'Other'
    const catIndex = categories.indexOf(cat)

    // Orbit radius: inner ring = strong consensus, outer ring = near 50/50
    const pct = topic.blue_pct ?? 50
    const polarization = Math.abs(pct - 50) / 50  // 0=balanced, 1=decisive
    const bandCenter = maxR * 0.15 + catIndex * bandWidth + bandWidth / 2
    // Jitter within band based on polarization
    const jitter = (bandWidth * 0.35) * (1 - polarization)
    const orbitRadius = bandCenter + jitter

    // Size: 4–18px based on vote volume
    const volRatio = Math.sqrt(topic.total_votes / maxVotes)
    const size = 4 + volRatio * 14

    // Color by consensus direction
    let color: string
    if (pct >= 60) color = '#3b82f6'   // strong FOR
    else if (pct >= 55) color = '#60a5fa'  // mild FOR
    else if (pct <= 40) color = '#ef4444'   // strong AGAINST
    else if (pct <= 45) color = '#f87171'   // mild AGAINST
    else color = '#71717a'              // balanced

    // Orbital speed: faster for topics with fewer votes (newer/fresher)
    const baseSpeed = 0.08 + (1 - volRatio) * 0.25
    const orbitSpeed = baseSpeed + Math.random() * 0.04 - 0.02

    return {
      topic,
      orbitRadius,
      orbitSpeed,
      startAngle: (i / topics.length) * Math.PI * 2 + Math.random() * 0.3,
      size,
      color,
      ringColor: getCategoryColor(topic.category),
    }
  })
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function OrreryCanvas({
  planets,
  paused,
  onHover,
  onClick,
}: {
  planets: Planet[]
  paused: boolean
  onHover: (planet: Planet | null, x: number, y: number) => void
  onClick: (planet: Planet) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Current planet positions for hit testing
  const positionsRef = useRef<{ planet: Planet; x: number; y: number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      const resizeCtx = canvas.getContext('2d')
      if (resizeCtx) resizeCtx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(timestamp: number) {
      if (!canvas || !ctx) return
      const dt = (timestamp - lastFrameRef.current) / 1000
      lastFrameRef.current = timestamp
      if (!pausedRef.current) {
        timeRef.current += Math.min(dt, 0.05)
      }
      const t = timeRef.current

      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      const cx = W / 2
      const cy = H / 2
      const maxR = Math.min(W, H) * 0.46

      ctx.clearRect(0, 0, W, H)

      // Draw deep space background
      ctx.fillStyle = '#050508'
      ctx.fillRect(0, 0, W, H)

      // Draw faint star field (deterministic, skip redraw)
      if (planets.length > 0) {
        for (let s = 0; s < 120; s++) {
          const sx = ((s * 137.508 * W) % W + W) % W
          const sy = ((s * 97.3 * H) % H + H) % H
          const opacity = 0.1 + ((s * 73) % 100) / 500
          ctx.beginPath()
          ctx.arc(sx, sy, 0.8, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${opacity})`
          ctx.fill()
        }
      }

      // Draw orbital ring guides (faint, category-colored)
      const drawnRings = new Set<number>()
      for (const planet of planets) {
        const r = Math.round(planet.orbitRadius * maxR)
        if (!drawnRings.has(r)) {
          drawnRings.add(r)
          ctx.beginPath()
          ctx.arc(cx, cy, planet.orbitRadius * maxR, 0, Math.PI * 2)
          ctx.strokeStyle = planet.ringColor + '22'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Draw central core (consensus sun)
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28)
      coreGrad.addColorStop(0, '#fde68a')
      coreGrad.addColorStop(0.5, '#f59e0b')
      coreGrad.addColorStop(1, '#92400e')
      ctx.beginPath()
      ctx.arc(cx, cy, 22, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()

      // Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50)
      glowGrad.addColorStop(0, 'rgba(245,158,11,0.15)')
      glowGrad.addColorStop(1, 'rgba(245,158,11,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, 50, 0, Math.PI * 2)
      ctx.fillStyle = glowGrad
      ctx.fill()

      // Draw planets
      const positions: { planet: Planet; x: number; y: number }[] = []
      for (const planet of planets) {
        const angle = planet.startAngle + planet.orbitSpeed * t
        const r = planet.orbitRadius * maxR
        const px = cx + Math.cos(angle) * r
        const py = cy + Math.sin(angle) * r

        positions.push({ planet, x: px, y: py })

        // Planet glow
        const glowR = planet.size * 2.5
        const g = ctx.createRadialGradient(px, py, 0, px, py, glowR)
        g.addColorStop(0, planet.color + '55')
        g.addColorStop(1, planet.color + '00')
        ctx.beginPath()
        ctx.arc(px, py, glowR, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        // Planet body
        const planetGrad = ctx.createRadialGradient(
          px - planet.size * 0.3,
          py - planet.size * 0.3,
          planet.size * 0.1,
          px,
          py,
          planet.size,
        )
        planetGrad.addColorStop(0, lighten(planet.color, 30))
        planetGrad.addColorStop(1, darken(planet.color, 20))
        ctx.beginPath()
        ctx.arc(px, py, planet.size, 0, Math.PI * 2)
        ctx.fillStyle = planetGrad
        ctx.fill()
        ctx.strokeStyle = planet.color + 'aa'
        ctx.lineWidth = 0.8
        ctx.stroke()

        // Status glow for voting topics
        if (planet.topic.status === 'voting') {
          ctx.beginPath()
          ctx.arc(px, py, planet.size + 3 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2)
          ctx.strokeStyle = '#f59e0b88'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      positionsRef.current = positions
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [planets])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let closest: { planet: Planet; dist: number } | null = null
    for (const { planet, x, y } of positionsRef.current) {
      const dist = Math.hypot(mx - x, my - y)
      if (dist < planet.size + 12 && (!closest || dist < closest.dist)) {
        closest = { planet, dist }
      }
    }
    if (closest) {
      onHover(closest.planet, e.clientX, e.clientY)
    } else {
      onHover(null, 0, 0)
    }
  }

  function handleMouseLeave() {
    onHover(null, 0, 0)
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    for (const { planet, x, y } of positionsRef.current) {
      const dist = Math.hypot(mx - x, my - y)
      if (dist < planet.size + 12) {
        onClick(planet)
        return
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  )
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (n >> 16) + amount)
  const g = Math.min(255, ((n >> 8) & 0xff) + amount)
  const b = Math.min(255, (n & 0xff) + amount)
  return `rgb(${r},${g},${b})`
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `rgb(${r},${g},${b})`
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipData {
  planet: Planet
  x: number
  y: number
}

function OrreryTooltip({ data }: { data: TooltipData }) {
  const { planet, x, y } = data
  const topic = planet.topic
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const style: React.CSSProperties = {
    position: 'fixed',
    left: x + 16,
    top: y - 8,
    transform: x > window.innerWidth * 0.65 ? 'translateX(calc(-100% - 32px))' : undefined,
    zIndex: 50,
    maxWidth: 280,
    pointerEvents: 'none',
  }

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="rounded-xl bg-surface-100/95 border border-surface-300/60 backdrop-blur-sm shadow-2xl p-3"
    >
      <p className="text-xs font-semibold text-white leading-snug mb-2 line-clamp-2">
        {topic.statement}
      </p>
      {topic.category && (
        <p className="text-[11px] mb-2" style={{ color: getCategoryColor(topic.category) }}>
          {topic.category}
        </p>
      )}
      <div className="flex items-center gap-3 text-[11px] mb-2">
        <span className="text-for-400 font-medium">{forPct}% For</span>
        <span className="text-surface-500">·</span>
        <span className="text-against-400 font-medium">{againstPct}% Against</span>
      </div>
      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-against-500/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-for-500"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-surface-500">
        <span>{topic.total_votes.toLocaleString()} votes</span>
        <span>·</span>
        <span>{topic.total_arguments} args</span>
        <span>·</span>
        <span className={cn(
          'capitalize font-medium',
          topic.status === 'voting' && 'text-gold',
          topic.status === 'active' && 'text-for-400',
          topic.status === 'proposed' && 'text-surface-500',
        )}>
          {topic.status}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-surface-600">Click to open topic</p>
    </motion.div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function OrreryLegend() {
  return (
    <div className="absolute bottom-20 left-4 bg-surface-100/90 backdrop-blur-sm border border-surface-300/40 rounded-xl p-3 text-[11px] text-surface-500 space-y-1.5 max-w-[180px]">
      <p className="text-white font-semibold text-xs mb-2">How to read</p>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-for-500 shrink-0" />
        <span>FOR majority</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-against-500 shrink-0" />
        <span>AGAINST majority</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-surface-400 shrink-0" />
        <span>Near 50/50</span>
      </div>
      <div className="mt-1 pt-1 border-t border-surface-300/40">
        <p><strong className="text-surface-400">Size</strong> = vote count</p>
        <p><strong className="text-surface-400">Distance</strong> = polarization</p>
        <p><strong className="text-surface-400">Ring</strong> = category</p>
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function OrreryClient() {
  const [topics, setTopics] = useState<OrreryTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const [planets, setPlanets] = useState<Planet[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/orrery')
      .then((r) => r.json())
      .then((d) => {
        setTopics(d.topics ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Build planets once topics + container size are known
  useEffect(() => {
    if (topics.length === 0) return
    const container = containerRef.current
    if (!container) return
    const maxR = Math.min(container.offsetWidth, container.offsetHeight) * 0.46
    setPlanets(buildPlanets(topics, maxR))
  }, [topics])

  const handleHover = useCallback((planet: Planet | null, x: number, y: number) => {
    if (!planet) {
      setTooltip(null)
    } else {
      setTooltip({ planet, x, y })
    }
  }, [])

  const handleClick = useCallback((planet: Planet) => {
    setNavigatingTo(planet.topic.id)
    setTimeout(() => {
      window.location.href = `/topic/${planet.topic.id}`
    }, 150)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {})
    }
  }

  // Category list for the color key
  const categories = [...new Set(topics.map((t) => t.category).filter(Boolean))] as string[]

  return (
    <div className={cn('flex flex-col', fullscreen ? 'fixed inset-0 z-50 bg-surface-950' : 'min-h-screen bg-[#050508]')}>
      {!fullscreen && <TopBar />}

      {/* Header bar */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        fullscreen ? 'absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent' : 'bg-surface-950/80 backdrop-blur-sm border-b border-surface-300/20',
      )}>
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <Link href="/" className="text-surface-400 hover:text-white transition-colors p-1 -ml-1">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div>
            <h1 className="text-base font-bold text-white">Civic Orrery</h1>
            <p className="text-[11px] text-surface-500">
              {loading ? 'Loading debates…' : `${topics.length} debates in orbit`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend((v) => !v)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showLegend ? 'bg-for-600/20 text-for-400' : 'bg-surface-300/40 text-surface-400 hover:text-white',
            )}
            aria-label="Toggle legend"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPaused((v) => !v)}
            className="p-2 rounded-lg bg-surface-300/40 text-surface-400 hover:text-white transition-colors"
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-surface-300/40 text-surface-400 hover:text-white transition-colors"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Category color strip */}
      {!fullscreen && categories.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-surface-950/80 border-b border-surface-300/10">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: getCategoryColor(cat) }}
              />
              <span className="text-[11px] text-surface-500">{cat}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold mx-auto mb-3" />
              <p className="text-sm text-surface-500">Plotting debates in orbit…</p>
            </div>
          </div>
        ) : topics.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-surface-500 text-sm">No active debates to plot.</p>
          </div>
        ) : (
          <OrreryCanvas
            planets={planets}
            paused={paused}
            onHover={handleHover}
            onClick={handleClick}
          />
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && <OrreryTooltip data={tooltip} />}
        </AnimatePresence>

        {/* Legend overlay */}
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <OrreryLegend />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation flash */}
        <AnimatePresence>
          {navigatingTo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[10px] text-gold/60 mt-16 font-mono">CONSENSUS CORE</p>
        </div>
      </div>

      {!fullscreen && <BottomNav />}
    </div>
  )
}
