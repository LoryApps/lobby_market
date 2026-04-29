'use client'

import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function BracketError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <Trophy className="h-10 w-10 text-surface-400 mb-4" />
        <h2 className="text-lg font-semibold text-surface-900 mb-2">
          Bracket unavailable
        </h2>
        <p className="text-sm text-surface-500 mb-6 max-w-xs">
          We couldn&apos;t load the bracket right now. Try again or check back later.
        </p>
        <div className="flex gap-3">
          <Button onClick={reset} size="sm">
            Try again
          </Button>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back home
            </Button>
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
