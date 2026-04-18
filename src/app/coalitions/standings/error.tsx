'use client'

import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function StandingsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/coalitions"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <h1 className="font-mono text-2xl font-bold text-white">League Standings</h1>
          </div>
        </div>
        <ErrorCard onReset={reset} />
      </main>
      <BottomNav />
    </div>
  )
}
