'use client'

import { useEffect } from 'react'
import { Flame } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'

export default function CivicFormError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24">
        <EmptyState
          icon={Flame}
          title="Something went wrong"
          description="Could not load your civic form. Please try again."
          action={{ label: 'Try again', onClick: reset }}
        />
      </main>
      <BottomNav />
    </div>
  )
}
