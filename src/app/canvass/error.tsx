'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function CanvassError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[canvass error]', error)
  }, [error])

  return (
    <PageError
      title="Couldn't load your Canvass"
      description="Something went wrong fetching your unvoted topics. Please try again."
      onRetry={reset}
    />
  )
}
