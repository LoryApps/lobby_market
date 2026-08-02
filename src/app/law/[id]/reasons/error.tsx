'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error() {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-16 pb-24 text-center">
        <AlertCircle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="font-mono text-sm text-surface-500 mb-6">
          Couldn&apos;t load the vote reasons for this law.
        </p>
        <Link
          href={`/law/${params.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-300 font-mono text-sm hover:bg-surface-300 hover:text-white transition-colors"
        >
          Back to law
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
