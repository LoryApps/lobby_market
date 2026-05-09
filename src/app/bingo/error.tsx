'use client'

import { Scale } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BingoError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <EmptyState
          icon={Scale}
          title="Bingo card error"
          description="Something went wrong loading your card. Try again."
          actions={[{ label: 'Try again', onClick: reset }]}
        />
      </main>
      <BottomNav />
    </div>
  )
}
