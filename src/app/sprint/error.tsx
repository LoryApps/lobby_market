'use client'

import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

export default function SprintError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 px-4">
      <AlertTriangle className="h-8 w-8 text-against-400" />
      <p className="text-sm font-mono text-surface-400 text-center">
        Something went wrong loading Civic Sprint.
      </p>
      <Link href="/arcade" className="flex items-center gap-1.5 text-sm font-mono text-for-400 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to Arcade
      </Link>
    </div>
  )
}
