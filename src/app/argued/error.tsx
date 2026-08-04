'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function ArguedError({
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
    <PageError
      title="Could not load Most Argued"
      description="There was a problem fetching argument activity. Try refreshing."
      onRetry={reset}
    />
  )
}
