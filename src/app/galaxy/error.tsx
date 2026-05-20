'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GalaxyError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col h-screen bg-[#060810]">
      <TopBar />
      <div className="flex-1 flex items-center justify-center gap-4 text-center px-4 flex-col">
        <Sparkles className="h-10 w-10 text-surface-500" aria-hidden="true" />
        <p className="font-mono text-sm text-surface-500">The galaxy failed to render.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
