'use client'

import { Activity } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DopplerError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20">
        <EmptyState
          icon={Activity}
          title="Doppler error"
          description="Something went wrong loading the Civic Doppler."
          action={{ label: 'Try again', onClick: reset }}
        />
      </main>
      <BottomNav />
    </div>
  )
}
