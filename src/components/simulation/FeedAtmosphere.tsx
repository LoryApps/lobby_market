'use client'

import { useEffect, useRef, useState } from 'react'

// Tailwind for-500 / against-500
const BLUE = '59, 130, 246'
const RED = '239, 68, 68'

export function FeedAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const visibleRef = useRef<boolean>(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Mobile: skip canvas entirely — CSS fallback via background gradients
    const isMobile =
      typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const drawBlob = (
      x: number,
      y: number,
      radius: number,
      colorRgb: string,
      alpha: number
    ) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(${colorRgb}, ${alpha})`)
      gradient.addColorStop(0.5, `rgba(${colorRgb}, ${alpha * 0.3})`)
      gradient.addColorStop(1, `rgba(${colorRgb}, 0)`)
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    const renderFrame = (t: number) => {
      const W = window.innerWidth
      const H = window.innerHeight
      ctx.clearRect(0, 0, W, H)

      // Very subtle atmosphere
      ctx.globalCompositeOperation = 'screen'

      const radius = Math.max(W, H) * 0.7

      // Blue blob: top-left, drifts in slow sine wave
      // Period ~30s
      const phase = reduceMotion ? 0 : (t / 30000) * Math.PI * 2
      const blueX = W * 0.2 + Math.sin(phase) * W * 0.1
      const blueY = H * 0.25 + Math.cos(phase * 0.7) * H * 0.08
      drawBlob(blueX, blueY, radius, BLUE, 0.05)

      // Red blob: bottom-right, offset phase
      const redX = W * 0.8 + Math.sin(phase + Math.PI) * W * 0.1
      const redY = H * 0.75 + Math.cos(phase * 0.7 + Math.PI) * H * 0.08
      drawBlob(redX, redY, radius, RED, 0.04)

      ctx.globalCompositeOperation = 'source-over'
    }

    // Initial render
    startRef.current = performance.now()
    renderFrame(0)

    if (reduceMotion) {
      // Static render, no animation
      window.addEventListener('resize', () => renderFrame(0))
      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    // IntersectionObserver to pause when offscreen
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          visibleRef.current = entries[0]?.isIntersecting ?? true
        },
        { threshold: 0 }
      )
      io.observe(canvas)
    }

    // Animate at 30fps (half rAF rate)
    const FRAME_INTERVAL = 1000 / 30

    const tick = (now: number) => {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const elapsed = now - lastFrameRef.current
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameRef.current = now
        renderFrame(now - startRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (io) io.disconnect()
    }
  }, [mounted])

  // Mobile CSS fallback: static gradient via inline style
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
      style={{
        // Mobile fallback (canvas is skipped on mobile)
        background:
          'radial-gradient(ellipse at 20% 25%, rgba(59, 130, 246, 0.04), transparent 50%), radial-gradient(ellipse at 80% 75%, rgba(239, 68, 68, 0.035), transparent 50%)',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full hidden md:block"
      />
    </div>
  )
}
