'use client'

import { Scale } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'

export default function OpposingError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-16 pb-24 md:pb-12">
        <EmptyState
          icon={Scale}
          title="Could Not Load"
          description="Opposing voices are temporarily unavailable. Please refresh to try again."
          actions={[{ label: 'Go Back', href: '/arguments' }]}
        />
      </main>
      <BottomNav />
    </div>
  )
}
