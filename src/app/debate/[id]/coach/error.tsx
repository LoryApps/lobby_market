'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PageError } from '@/components/ui/PageError'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DebateCoachError({ error, reset }: ErrorProps) {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Link
          href={`/debate/${params.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>
        <PageError
          error={error}
          reset={reset}
          page="Debate Coach"
          backHref={`/debate/${params.id}`}
          backLabel="Back to debate"
        />
      </main>
      <BottomNav />
    </div>
  )
}
