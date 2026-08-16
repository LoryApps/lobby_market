'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Compass, Gavel, Loader2, MessageSquare, Scale, Users } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TARGET_OPTIONS = [
  { value: 'topic', label: 'Random Topic', icon: Scale, color: 'text-for-400', bg: 'bg-for-900/30 border-for-800/50' },
  { value: 'law', label: 'Random Law', icon: Gavel, color: 'text-gold', bg: 'bg-gold/10 border-gold/20' },
  { value: 'argument', label: 'Random Argument', icon: MessageSquare, color: 'text-against-400', bg: 'bg-against-900/30 border-against-800/50' },
  { value: 'citizen', label: 'Random Citizen', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/40' },
  { value: 'debate', label: 'Random Debate', icon: Compass, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/40' },
] as const

function RandomInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)
  const [selected, setSelected] = useState<string>(searchParams.get('type') ?? 'topic')
  const initialLoad = useRef(true)

  const navigate = async (type: string) => {
    setNavigating(true)
    try {
      const res = await fetch(`/api/random?type=${type}`)
      if (res.ok) {
        const { redirect } = await res.json()
        if (redirect) {
          router.push(redirect)
          return
        }
      }
    } catch {
      /* fall through */
    }
    setNavigating(false)
  }

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      const type = searchParams.get('type')
      if (type) navigate(type)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-surface-950 items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-purple-900/30 border border-purple-800/50 mb-2">
            <Compass className="h-7 w-7 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Surprise Me</h1>
          <p className="text-sm text-surface-400">Jump to something unexpected in the Lobby</p>
        </div>

        <div className="space-y-2">
          {TARGET_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isSelected = selected === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setSelected(opt.value)
                  navigate(opt.value)
                }}
                disabled={navigating}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                  isSelected
                    ? opt.bg + ' ' + opt.color
                    : 'bg-surface-100 border-surface-300 text-surface-300 hover:border-surface-400 hover:text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {navigating && isSelected ? (
                  <Loader2 className={cn('h-5 w-5 shrink-0 animate-spin', opt.color)} />
                ) : (
                  <Icon className={cn('h-5 w-5 shrink-0', isSelected ? opt.color : 'text-surface-500')} />
                )}
                <span className="font-medium text-sm">
                  {navigating && isSelected
                    ? `Finding a ${opt.label.split(' ')[1].toLowerCase()}…`
                    : opt.label}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-surface-600">
          Or try{' '}
          <a href="/serendipity" className="text-purple-400 hover:underline">
            Civic Serendipity
          </a>{' '}
          for curated discovery
        </p>
      </motion.div>
    </div>
  )
}

export default function RandomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-surface-950">
          <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
        </div>
      }
    >
      <RandomInner />
    </Suspense>
  )
}
