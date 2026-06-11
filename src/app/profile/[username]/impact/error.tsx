'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4 pt-20 pb-24">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
          <p className="text-white font-semibold">Could not load impact data</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-surface-200 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-200 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
