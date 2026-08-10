'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function LawsAtRiskError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <PageError message="Failed to load laws at risk." onRetry={reset} />
}
