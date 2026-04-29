'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function ArgumentGraphError() {
  const params = useParams<{ id: string }>()
  return (
    <div className="h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 px-4">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
        <AlertTriangle className="h-6 w-6 text-against-400" aria-hidden="true" />
      </div>
      <p className="font-mono text-white font-semibold">Failed to load argument graph</p>
      <p className="text-sm font-mono text-surface-500 text-center max-w-xs">
        Something went wrong rendering this debate visualization.
      </p>
      <Link
        href={params.id ? `/topic/${params.id}` : '/'}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to topic
      </Link>
    </div>
  )
}
