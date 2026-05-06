'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function CommonThreadsError({
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
      title="Could not load Common Threads"
      description="An error occurred loading civic argument themes. Please try again."
      onReset={reset}
    />
  )
}
