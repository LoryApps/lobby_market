'use client'

import { useEffect } from 'react'
import { Users } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'

export default function VoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[voices] page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 md:pb-12" id="main-content">
        <EmptyState
          icon={Users}
          title="Failed to load Civic Voices"
          description="Something went wrong while fetching voices. Please try again."
          actions={[{ label: 'Try Again', onClick: reset }]}
        />
      </main>
      <BottomNav />
    </div>
  )
}
