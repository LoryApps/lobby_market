'use client'

import { ArrowLeft, Waves } from 'lucide-react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

export default function RippleError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <Link
          href=".."
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>
        <PageError
          icon={<Waves className="h-8 w-8 text-surface-500" />}
          title="Ripple Effect Error"
          message={error.message}
          onRetry={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
