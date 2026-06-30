'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

export default function Error() {
  const params = useParams()
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 px-4">
      <AlertTriangle className="w-8 h-8 text-against-400" />
      <p className="text-sm text-surface-400 text-center">Failed to load the intelligence report.</p>
      <Link
        href={`/topic/${params.id as string}`}
        className="text-sm text-for-400 hover:text-for-300 transition-colors"
      >
        Back to debate
      </Link>
    </div>
  )
}
