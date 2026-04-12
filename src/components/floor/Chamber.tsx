'use client'

import { useEffect, useRef, useState } from 'react'
import type { Topic } from '@/lib/supabase/types'
import {
  DEFAULT_LAYOUT,
  COMPACT_LAYOUT,
  assignAffinities,
  colorFromAffinity,
  computeBounds,
  generateSeats,
  projectSeats,
  rgb,
  type Seat,
} from '@/lib/floor/chamber-math'

export interface SeatCluster {
  seatId: number
  row: number
  affinity: number
  // Estimated cluster size — seats near the front represent more users
  clusterSize: number
}

interface ChamberProps {
  topic: Topic
  onSeatHover?: (cluster: SeatCluster | null) => void
  onVotePulse?: number // increments to trigger pulses externally
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

// Small hash for deterministic per-seat jitter in animation phases
function seatPhase(id: number) {
  const s = Math.sin(id * 374.62 + 5.31) * 4571.18
  return s - Math.floor(s)
}

export function Chamber({ topic, onSeatHover, onVotePulse }: ChamberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const seatsRef = useRef<Seat[]>([])
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const hoveredSeatRef = useRef<Seat | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const rostrumFlashRef = useRef<number>(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Responsive layout — compact on narrow viewports
  const isCompact =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches

  // Generate seats + assign affinities once topic changes
  useEffect(() => {
    const layout = isCompact ? COMPACT_LAYOUT : DEFAULT_LAYOUT
    const seats = generateSeats(layout)
    projectSeats(seats)
    assignAffinities(seats, topic.blue_pct)
    // Stagger fade-in by row
    for (const seat of seats) {
      seat.fadeIn = 0
    }
    seatsRef.current = seats
    // Restart bootup timer so new seats fade in
    startTimeRef.current = performance.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, topic.blue_pct, isCompact])

  // Vote pulse trigger — pick a random seat on the winning side and pulse it
  useEffect(() => {
    if (onVotePulse === undefined) return
    const seats = seatsRef.current
    if (seats.length === 0) return
    // Determine which side got the pulse — if blue_pct > 50 assume blue
    const preferBlue = topic.blue_pct >= 50
    const candidates = seats.filter((s) =>
      preferBlue ? s.affinity > 0.55 : s.affinity < 0.45
    )
    const pool = candidates.length > 0 ? candidates : seats
    // Pick several seats for a ripple effect
    for (let i = 0; i < 3; i++) {
      const seat = pool[Math.floor(Math.random() * pool.length)]
      seat.pulseTarget = 1
      seat.pulse = Math.max(seat.pulse, 0.2)
    }
    rostrumFlashRef.current = 1
    // Spawn a few drifting particles from the rostrum
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: (Math.random() - 0.5) * 40,
        y: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.6 - Math.random() * 0.5,
        life: 0,
        maxLife: 120 + Math.random() * 80,
        size: 1 + Math.random() * 1.5,
      })
    }
  }, [onVotePulse, topic.blue_pct])

  // Resize handling + DPR
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleResize = () => {
      const rect = container.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
    handleResize()
    const ro = new ResizeObserver(handleResize)
    ro.observe(container)
    window.addEventListener('resize', handleResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Build the static background buffer (seat base renders) when
  // dimensions or topic change so the main loop only draws dynamic
  // effects + highlights on top.
  useEffect(() => {
    const { width, height } = dimensions
    if (width === 0 || height === 0) return
    if (seatsRef.current.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const bg = document.createElement('canvas')
    bg.width = Math.round(width * dpr)
    bg.height = Math.round(height * dpr)
    const ctx = bg.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    drawBackground(ctx, width, height, topic.blue_pct)
    bgCanvasRef.current = bg
  }, [dimensions, topic.id, topic.blue_pct])

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = dimensions
    if (width === 0 || height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Compute center + scale so all seats fit nicely
    const seats = seatsRef.current
    const bounds = computeBounds(seats)
    // Reserve top third for the rostrum + topic text
    const topReserve = height * 0.22
    const bottomReserve = height * 0.1
    const avail = {
      x: width * 0.92,
      y: height - topReserve - bottomReserve,
    }
    const scale = Math.min(
      avail.x / Math.max(bounds.width, 1),
      avail.y / Math.max(bounds.height, 1)
    ) * 0.95
    const centerScreenX = width / 2
    const centerScreenY = topReserve + avail.y * 0.55
    const centerWorldX = (bounds.minX + bounds.maxX) / 2
    const centerWorldY = (bounds.minY + bounds.maxY) / 2

    const toScreen = (seat: Seat) => {
      return {
        x: centerScreenX + (seat.screenX - centerWorldX) * scale,
        y: centerScreenY + (seat.screenY - centerWorldY) * scale,
      }
    }

    const rostrumScreen = (() => {
      // Rostrum lives at worldX=0, worldZ=0 (origin), slightly elevated
      const wy = -12
      const sx = 0
      const sy = -wy // project: (0+0)*sin - (-12) = 12
      return {
        x: centerScreenX + (sx - centerWorldX) * scale,
        y: centerScreenY + (sy - centerWorldY) * scale,
      }
    })()

    const render = (now: number) => {
      const dt = Math.min(now - lastFrameRef.current, 50)
      lastFrameRef.current = now
      const t = (now - startTimeRef.current) / 1000

      // Background — draw precomputed buffer
      ctx.clearRect(0, 0, width, height)
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0, width, height)
      }

      // Floor glow pad under the chamber
      drawFloorGlow(ctx, centerScreenX, centerScreenY, avail.x * 0.6, topic.blue_pct)

      // Particles
      updateAndDrawParticles(ctx, particlesRef.current, dt, rostrumScreen)

      // Rostrum base
      drawRostrum(ctx, rostrumScreen.x, rostrumScreen.y, scale, rostrumFlashRef.current)
      rostrumFlashRef.current = Math.max(0, rostrumFlashRef.current - dt / 600)

      // Sort seats back-to-front (larger screenY drawn later)
      const order = [...seats].sort((a, b) => {
        const ay = toScreen(a).y
        const by = toScreen(b).y
        return ay - by
      })

      // Update & draw each seat
      for (const seat of order) {
        // Fade in staggered by row — each row boots ~120ms after the last
        const rowDelay = seat.row * 0.12
        const seatDelay = seat.seatInRow * 0.005
        const activation = Math.max(0, Math.min(1, (t - rowDelay - seatDelay) / 0.6))
        seat.fadeIn = activation

        // Pulse decay
        if (seat.pulseTarget > 0) {
          seat.pulse += (seat.pulseTarget - seat.pulse) * 0.2
          if (seat.pulse > 0.95) {
            seat.pulseTarget = 0
          }
        } else {
          seat.pulse *= 0.94
        }

        // Breathing — subtle ±2% scale on a slow sine
        const phase = seatPhase(seat.id) * Math.PI * 2
        const breathing = 1 + Math.sin(t * 1.3 + phase) * 0.02

        const { x, y } = toScreen(seat)
        const size = seat.size * scale * breathing
        drawSeat(ctx, x, y, size, seat, seat === hoveredSeatRef.current)
      }

      rafRef.current = requestAnimationFrame(render)
    }

    lastFrameRef.current = performance.now()
    if (startTimeRef.current === 0) startTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(render)

    // Hover handling
    const handleMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let best: Seat | null = null
      let bestDist = 20
      for (const seat of seats) {
        const p = toScreen(seat)
        const dx = p.x - mx
        const dy = p.y - my
        const d = dx * dx + dy * dy
        if (d < bestDist * bestDist) {
          bestDist = Math.sqrt(d)
          best = seat
        }
      }
      hoveredSeatRef.current = best
      canvas.style.cursor = best ? 'pointer' : 'default'
      if (onSeatHover) {
        if (best) {
          const front = DEFAULT_LAYOUT.rows - best.row
          onSeatHover({
            seatId: best.id,
            row: best.row,
            affinity: best.affinity,
            clusterSize: Math.max(100, front * 240),
          })
        } else {
          onSeatHover(null)
        }
      }
    }
    const handleLeave = () => {
      hoveredSeatRef.current = null
      if (onSeatHover) onSeatHover(null)
    }

    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerleave', handleLeave)

    return () => {
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerleave', handleLeave)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [dimensions, topic.id, topic.blue_pct, onSeatHover])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, rgba(10, 14, 30, 0.8) 0%, rgba(0,0,0,1) 70%)',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// ---------- Drawing helpers ----------

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bluePct: number
) {
  // True black base
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  // Ambient tint — chamber leans blue or red based on topic
  const leanBlue = bluePct / 100
  const tintR = Math.round(60 * (1 - leanBlue))
  const tintG = Math.round(20 * (1 - Math.abs(leanBlue - 0.5)))
  const tintB = Math.round(80 * leanBlue)
  const radial = ctx.createRadialGradient(
    width / 2,
    height * 0.4,
    0,
    width / 2,
    height * 0.4,
    Math.max(width, height) * 0.8
  )
  radial.addColorStop(0, `rgba(${tintR + 20}, ${tintG + 10}, ${tintB + 30}, 0.35)`)
  radial.addColorStop(0.5, `rgba(${tintR}, ${tintG}, ${tintB}, 0.12)`)
  radial.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, width, height)

  // Subtle vignette
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.4,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.9
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.75)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  // Faint grid lines at the bottom hinting at a floor
  ctx.strokeStyle = 'rgba(255,255,255,0.015)'
  ctx.lineWidth = 1
  for (let i = 0; i < 8; i++) {
    const y = height * 0.72 + i * 12
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function drawFloorGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  bluePct: number
) {
  const leanBlue = bluePct / 100
  const r = Math.round(239 * (1 - leanBlue) + 59 * leanBlue)
  const g = Math.round(68 * (1 - leanBlue) + 130 * leanBlue)
  const b = Math.round(68 * (1 - leanBlue) + 246 * leanBlue)
  const grad = ctx.createRadialGradient(cx, cy + radius * 0.1, 0, cx, cy + radius * 0.1, radius)
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.18)`)
  grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.06)`)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(cx, cy + radius * 0.1, radius, radius * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawSeat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seat: Seat,
  hovered: boolean
) {
  if (seat.fadeIn <= 0) return
  const color = colorFromAffinity(seat.affinity)
  const pulse = seat.pulse
  const alpha = seat.fadeIn

  // Ambient glow under the seat (bigger on pulse)
  const glowSize = size * (1.8 + pulse * 2)
  const glowGrad = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, glowSize)
  glowGrad.addColorStop(0, rgb(color, (0.45 + pulse * 0.4) * alpha))
  glowGrad.addColorStop(1, rgb(color, 0))
  ctx.fillStyle = glowGrad
  ctx.beginPath()
  ctx.arc(x, y + 1, glowSize, 0, Math.PI * 2)
  ctx.fill()

  // The isometric diamond (4-point) representing the seat cushion
  const w = size
  const h = size * 0.55

  // Bottom face (darker)
  const bottom = {
    r: Math.round(color.r * 0.45),
    g: Math.round(color.g * 0.45),
    b: Math.round(color.b * 0.45),
  }
  ctx.fillStyle = rgb(bottom, alpha)
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x, y + h * 1.2)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x, y + h * 0.3)
  ctx.closePath()
  ctx.fill()

  // Top face (cushion)
  const brightR = Math.round(color.r * (1 + pulse * 0.6))
  const brightG = Math.round(color.g * (1 + pulse * 0.6))
  const brightB = Math.round(color.b * (1 + pulse * 0.6))
  const top = {
    r: Math.min(255, brightR),
    g: Math.min(255, brightG),
    b: Math.min(255, brightB),
  }
  ctx.fillStyle = rgb(top, alpha)
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x, y - h)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x, y + h * 0.3)
  ctx.closePath()
  ctx.fill()

  // Top face highlight strip
  const highlight = {
    r: Math.min(255, top.r + 60),
    g: Math.min(255, top.g + 60),
    b: Math.min(255, top.b + 60),
  }
  ctx.strokeStyle = rgb(highlight, 0.6 * alpha)
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(x - w * 0.6, y - h * 0.3)
  ctx.lineTo(x, y - h * 0.85)
  ctx.stroke()

  // Outline
  ctx.strokeStyle = `rgba(0,0,0,${0.45 * alpha})`
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x, y - h)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x, y + h * 1.2)
  ctx.closePath()
  ctx.stroke()

  // Hover outline — gold
  if (hovered) {
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - w - 1, y)
    ctx.lineTo(x, y - h - 1)
    ctx.lineTo(x + w + 1, y)
    ctx.lineTo(x, y + h * 1.2 + 1)
    ctx.closePath()
    ctx.stroke()
  }
}

function drawRostrum(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  flash: number
) {
  const w = 58 * scale
  const h = 18 * scale

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(x, y + h * 0.8, w * 0.9, h * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Rostrum base — isometric box
  const topGrad = ctx.createLinearGradient(x - w, y - h, x + w, y + h)
  topGrad.addColorStop(0, '#2a2a36')
  topGrad.addColorStop(0.5, '#1a1a22')
  topGrad.addColorStop(1, '#12121a')
  ctx.fillStyle = topGrad

  // Front face
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x - w, y + h)
  ctx.lineTo(x, y + h * 1.5)
  ctx.lineTo(x, y + h * 0.5)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#1a1a22'
  ctx.beginPath()
  ctx.moveTo(x, y + h * 0.5)
  ctx.lineTo(x, y + h * 1.5)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y)
  ctx.closePath()
  ctx.fill()

  // Top
  const topFace = ctx.createLinearGradient(x - w, y - h, x + w, y + h * 0.5)
  topFace.addColorStop(0, '#3f3f4a')
  topFace.addColorStop(1, '#24242e')
  ctx.fillStyle = topFace
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x, y - h * 0.5)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x, y + h * 0.5)
  ctx.closePath()
  ctx.fill()

  // Gold rim
  ctx.strokeStyle = `rgba(245, 158, 11, ${0.55 + flash * 0.4})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x, y - h * 0.5)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x, y + h * 0.5)
  ctx.closePath()
  ctx.stroke()

  // Flash halo when a vote comes in
  if (flash > 0.01) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, w * 2.4)
    glow.addColorStop(0, `rgba(245, 158, 11, ${flash * 0.35})`)
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, w * 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  origin: { x: number; y: number }
) {
  // Occasionally spawn ambient drift particles
  if (Math.random() < 0.08 && particles.length < 40) {
    particles.push({
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.2) * 40,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.2 - Math.random() * 0.3,
      life: 0,
      maxLife: 300 + Math.random() * 200,
      size: 0.7 + Math.random() * 1.4,
    })
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life += dt / 16
    p.x += p.vx * (dt / 16)
    p.y += p.vy * (dt / 16)
    if (p.life >= p.maxLife) {
      particles.splice(i, 1)
      continue
    }
    const alpha = (1 - p.life / p.maxLife) * 0.5
    ctx.fillStyle = `rgba(255, 240, 200, ${alpha})`
    ctx.beginPath()
    ctx.arc(origin.x + p.x, origin.y + p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
}
