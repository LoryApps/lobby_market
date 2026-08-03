'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-against-400" />
      <h2 className="text-lg font-semibold text-surface-900">Something went wrong</h2>
      <p className="text-sm text-surface-500">Could not load the common ground analysis.</p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" size="sm">Try again</Button>
        <Link href="..">
          <Button variant="ghost" size="sm">Back to law</Button>
        </Link>
      </div>
    </div>
  )
}
