'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SolsticeError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-24 flex flex-col items-center text-center gap-4">
        <AlertTriangle className="h-8 w-8 text-against-500" />
        <p className="text-sm font-mono text-surface-400">Failed to load Civic Solstice data.</p>
        <Link href="/" className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors">
          Back to feed
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
