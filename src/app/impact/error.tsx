'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ImpactError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 md:pb-12 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <p className="text-surface-500 font-mono text-sm">Failed to load impact data.</p>
        <Link href="/analytics" className="text-for-400 text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to analytics
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
