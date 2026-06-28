'use client'

import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function AssemblyDetailError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-3xl mb-4">⚖️</p>
        <h1 className="text-lg font-mono font-bold text-white mb-2">Assembly not found</h1>
        <p className="text-sm text-surface-600 mb-6">
          This assembly may have been dissolved or the link is invalid.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm">Retry</Button>
          <Link href="/assembly" className="text-sm text-surface-500 hover:text-white transition-colors">
            All assemblies
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
