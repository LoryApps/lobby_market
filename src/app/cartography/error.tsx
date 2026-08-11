'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AlertTriangle } from 'lucide-react'

export default function CartographyError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400" />
        <p className="text-white font-mono font-semibold">Failed to load the Civic Cartography</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
