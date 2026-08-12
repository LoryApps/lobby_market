'use client'

import { AlertTriangle } from 'lucide-react'
import { PageError } from '@/components/ui/PageError'

export default function OutliersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      icon={AlertTriangle}
      title="Couldn't load civic paradoxes"
      description={error.message ?? 'An unexpected error occurred. Please try again.'}
      onRetry={reset}
    />
  )
}
