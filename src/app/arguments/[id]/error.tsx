'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function ArgumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 text-center" id="main-content">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Argument not available
        </h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          This argument may have been removed or the link is invalid.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" onClick={reset}>Try again</Button>
          <Link href="/">
            <Button variant="for">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Go home
            </Button>
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
