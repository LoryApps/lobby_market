'use client'

import { RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'

export default function MentorError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28">
        <EmptyState
          icon={RefreshCw}
          title="Couldn't load the Mentor Exchange"
          description="Something went wrong fetching mentors. Please try again."
          actions={[
            { label: 'Try again', onClick: reset },
            { label: 'Go home', href: '/', variant: 'secondary' },
          ]}
        />
      </main>
      <BottomNav />
    </div>
  )
}
