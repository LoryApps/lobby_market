'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function RewindError({
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
      title="Rewind failed"
      description="We couldn't load the civic history for this date."
      onReset={reset}
    />
  )
}
