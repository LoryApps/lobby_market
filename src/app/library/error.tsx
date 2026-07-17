'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function LibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Library Error]', error)
  }, [error])

  return (
    <PageError
      title="Library unavailable"
      description="We couldn't load the Civic Library. Try refreshing."
      onRetry={reset}
    />
  )
}
