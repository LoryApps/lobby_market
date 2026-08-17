'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function TopicOfTheDayError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-against-500/10 border border-against-500/20 mx-auto">
            <AlertCircle className="h-7 w-7 text-against-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white mb-1">Spotlight unavailable</h1>
            <p className="text-sm text-surface-500 leading-relaxed">
              Couldn&apos;t load today&apos;s civic spotlight. The Lobby is still active.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="for" onClick={reset} className="w-full">
              Try again
            </Button>
            <Link href="/trending">
              <Button variant="secondary" className="w-full">
                Browse trending topics
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
