'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NearLawError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
          <p className="text-white font-semibold">Failed to load Near-Law Radar</p>
          <p className="text-sm text-surface-500">Something went wrong. Please try again.</p>
          <Link
            href="/exchange"
            className="inline-flex items-center gap-2 text-sm text-for-400 hover:text-for-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Exchange
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
