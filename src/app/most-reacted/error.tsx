'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function Error() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertCircle className="h-8 w-8 text-against-400" aria-hidden="true" />
      <p className="text-white font-semibold">Something went wrong</p>
      <Link href="/" className="text-sm text-purple hover:text-purple/80 transition-colors">
        Back to feed
      </Link>
    </div>
  )
}
