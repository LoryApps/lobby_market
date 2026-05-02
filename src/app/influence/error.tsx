'use client'

import Link from 'next/link'
import { Network } from 'lucide-react'

export default function Error() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center">
        <Network className="h-10 w-10 text-surface-500 mx-auto mb-3" />
        <p className="text-surface-400 font-mono text-sm">Could not load influence graph.</p>
        <Link href="/analytics" className="text-for-400 text-sm font-mono hover:underline mt-2 inline-block">
          Back to analytics
        </Link>
      </div>
    </div>
  )
}
