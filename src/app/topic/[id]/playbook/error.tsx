'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PlaybookError() {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-against-400" />
        <h1 className="text-lg font-mono font-bold text-white">Playbook unavailable</h1>
        <p className="text-sm font-mono text-surface-500 max-w-xs">
          Could not load the campaign playbook for this topic. Please try again.
        </p>
        <Link
          href={`/topic/${params.id}`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
