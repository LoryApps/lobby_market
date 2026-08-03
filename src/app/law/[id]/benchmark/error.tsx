'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        <PageError
          title="Benchmark unavailable"
          description="We could not load the benchmark data for this law."
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
