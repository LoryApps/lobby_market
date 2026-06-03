'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function ElectionsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-28 pt-32 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-against-400" />
        <h1 className="mb-2 text-xl font-bold text-surface-900">Failed to load elections</h1>
        <p className="mb-6 text-sm text-surface-500">{error.message}</p>
        <div className="flex gap-3">
          <Button variant="default" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/">
            <Button variant="ghost">Go home</Button>
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
