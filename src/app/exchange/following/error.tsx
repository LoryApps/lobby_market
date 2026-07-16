'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function FollowingError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <PageError
          title="Could not load following feed"
          description="There was an error loading positions from traders you follow."
          onRetry={reset}
        />
      </div>
      <BottomNav />
    </div>
  )
}
