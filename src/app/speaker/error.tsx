'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function SpeakerError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-24 flex items-center justify-center">
        <PageError
          title="Speaker's Chair unavailable"
          description="The Office of the Speaker could not be reached. Please try again."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
