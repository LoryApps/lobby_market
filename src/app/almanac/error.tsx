'use client'

import Link from 'next/link'
import { ArrowLeft, Scroll } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function AlmanacError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Scroll className="h-4 w-4 text-gold" />
            <h1 className="text-base font-mono font-bold text-white">Civic Almanac</h1>
          </div>
        </div>
        <ErrorCard title="Almanac unavailable" message="Could not load civic history right now. Please try again later." />
      </main>
      <BottomNav />
    </div>
  )
}
