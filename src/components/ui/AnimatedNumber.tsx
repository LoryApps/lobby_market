'use client'

import { useEffect, useRef } from 'react'
import { useSpring, useTransform, motion, type MotionValue } from 'framer-motion'

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

function AnimatedDigits({ motionValue }: { motionValue: MotionValue<number> }) {
  const ref = useRef<HTMLSpanElement>(null)
  const display = useTransform(motionValue, (latest) => formatNumber(latest))

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      if (ref.current) {
        ref.current.textContent = v
      }
    })
    return unsubscribe
  }, [display])

  return <span ref={ref}>{formatNumber(motionValue.get())}</span>
}

interface AnimatedNumberProps {
  value: number
  className?: string
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  })

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return (
    <motion.span className={className}>
      <AnimatedDigits motionValue={spring} />
    </motion.span>
  )
}
