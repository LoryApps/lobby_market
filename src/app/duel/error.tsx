'use client'

import { useEffect } from 'react'
import { Swords } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'

export default function DuelError({
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
      <main className="max-w-2xl mx-auto px-4 py-16 pb-28 md:pb-16">
        <EmptyState
          icon={Swords}
          iconColor="text-surface-500"
          title="Duel arena offline"
          description="Something went wrong loading the argument duel. Try again."
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
