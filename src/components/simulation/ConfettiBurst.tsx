'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  lifetime: number
  maxLifetime: number
  size: number
  color: string
  shape: 'circle' | 'square' | 'strip'
}

interface ConfettiBurstProps {
  trigger: number
  side: 'blue' | 'red'
  originX?: number
  originY?: number
}

// Tailwind for-300 -> for-600 (blue)
const BLUE_PALETTE = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb']
// Tailwind against-300 -> against-600 (red)
const RED_PALETTE = ['#fca5a5', '#f87171', '#ef4444', '#dc2626']

const GRAVITY = 0.35
const AIR_FRICTION = 0.985

function randRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function createParticle(
  x: number,
  y: number,
  palette: string[]
): Particle {
  const angle = randRange(-Math.PI, 0) // upward arc
  const speed = randRange(3, 9)
  const maxLifetime = randRange(60, 90) // ~1 to 1.5s at 60fps
  const shapes: Particle['shape'][] = ['circle', 'square', 'strip']
  return {
    x,
    y,
    vx: Math.cos(angle) * speed + randRange(-1.5, 1.5),
    vy: Math.sin(angle) * speed - randRange(1, 3),
    rotation: randRange(0, Math.PI * 2),
    rotationSpeed: randRange(-0.25, 0.25),
    lifetime: 0,
    maxLifetime,
    size: randRange(4, 9),
    color: palette[Math.floor(Math.random() * palette.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  }
}

export function ConfettiBurst(props: ConfettiBurstProps) {
  const { trigger, side, originX, originY } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const lastTriggerRef = useRef<number>(trigger)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Resize canvas to fill parent
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    // Only spawn on trigger change (skip mount with trigger=0)
    if (trigger !== lastTriggerRef.current) {
      lastTriggerRef.current = trigger

      if (!reduceMotion) {
        const rect = canvas.getBoundingClientRect()
        const cx = originX ?? rect.width / 2
        const cy = originY ?? rect.height / 2
        const palette = side === 'blue' ? BLUE_PALETTE : RED_PALETTE

        const isMobile =
          typeof window !== 'undefined' && window.innerWidth < 768
        const count = isMobile ? 20 : Math.floor(randRange(30, 40))

        for (let i = 0; i < count; i++) {
          particlesRef.current.push(createParticle(cx, cy, palette))
        }
      }
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.lifetime += 1
        p.vy += GRAVITY
        p.vx *= AIR_FRICTION
        p.vy *= AIR_FRICTION
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed

        const t = p.lifetime / p.maxLifetime
        const alpha = Math.max(0, 1 - t * t)

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color

        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        } else {
          // strip: thin confetti rectangle
          ctx.fillRect(-p.size / 2, -p.size / 6, p.size * 1.4, p.size / 3)
        }

        ctx.restore()

        if (p.lifetime >= p.maxLifetime) {
          particles.splice(i, 1)
        }
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    // Start animating if there are particles and not already running
    if (particlesRef.current.length > 0 && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      ro.disconnect()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [trigger, side, originX, originY])

  // Cleanup on unmount — clear particles
  useEffect(() => {
    return () => {
      particlesRef.current = []
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
