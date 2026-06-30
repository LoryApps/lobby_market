'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WhatIfError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertTriangle className="w-10 h-10 text-against-400" />
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Scenario Lab Unavailable</h2>
          <p className="text-sm text-surface-600">{error.message ?? 'Something went wrong loading scenario data.'}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={reset}
            className="text-sm text-for-400 hover:text-for-300 transition-colors"
          >
            Try again
          </button>
          <Link href=".." className="flex items-center gap-1 text-sm text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to topic
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
