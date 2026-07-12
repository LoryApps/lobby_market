'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function GovernmentError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-0 text-white">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28">
        <PageError message={error.message} onRetry={reset} />
      </main>
      <BottomNav />
    </div>
  )
}
