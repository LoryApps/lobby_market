'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function HearingDetailError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-surface-200 flex items-center justify-center mb-5">
          <AlertCircle className="h-6 w-6 text-surface-500" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Hearing not found</h1>
        <p className="text-sm text-surface-500 mb-6">
          This hearing may have been archived or removed.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/hearings">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              All hearings
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
