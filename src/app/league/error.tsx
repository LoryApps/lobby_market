'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LeagueError() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Trophy className="h-10 w-10 text-gold opacity-50" />
        <p className="text-white font-semibold">Couldn&apos;t load league standings</p>
        <Link href="/leaderboard" className="text-for-400 text-sm hover:text-for-300 transition-colors">
          Back to Leaderboard
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
