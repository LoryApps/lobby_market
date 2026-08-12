'use client'

import { RotateCcw } from 'lucide-react'
import { PageError } from '@/components/ui/PageError'

export default function ReversalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      icon={RotateCcw}
      title="Couldn't load opinion reversals"
      description={error.message ?? 'An unexpected error occurred. Please try again.'}
      onRetry={reset}
    />
  )
}
