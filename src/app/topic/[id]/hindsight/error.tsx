'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function HindsightError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <AlertCircle className="h-8 w-8 text-against-400" />
      <p className="text-surface-400 text-sm text-center">Failed to load hindsight data.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          Try again
        </button>
        <Link
          href={`/topic/${id}`}
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          Back to topic
        </Link>
      </div>
    </div>
  )
}
