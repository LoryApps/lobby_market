'use client'

import { PageError } from '@/components/ui/PageError'

export default function ContributorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Could not load contributors"
      description={error.message ?? 'An unexpected error occurred. Please try again.'}
      onRetry={reset}
    />
  )
}
