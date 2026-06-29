'use client'

import { Landmark } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TownHallError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-12 pb-24">
        <EmptyState
          icon={Landmark}
          title="Town Hall Unavailable"
          description="The Civic Town Hall could not be loaded. Please try refreshing."
          action={{ label: 'Try again', onClick: reset }}
        />
      </main>
      <BottomNav />
    </div>
  )
}
