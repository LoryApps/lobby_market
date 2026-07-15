'use client'

import { BarChart2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-24">
        <EmptyState
          icon={BarChart2}
          iconColor="text-against-400"
          iconBg="bg-against-500/10"
          iconBorder="border-against-500/20"
          title="Something went wrong"
          description="Could not load the market correlation matrix."
          action={{ label: 'Back to Exchange', href: '/exchange' }}
        />
      </main>
      <BottomNav />
    </div>
  )
}
