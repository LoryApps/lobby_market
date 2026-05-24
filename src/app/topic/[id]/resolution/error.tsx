'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ResolutionError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-12 pb-24 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
        <p className="text-surface-600 mb-4">Failed to load resolution data.</p>
        <Link href="/" className="text-for-400 text-sm hover:underline">Back to feed</Link>
      </main>
      <BottomNav />
    </div>
  )
}
