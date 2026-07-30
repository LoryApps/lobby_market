'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load similar topics"
      description={error.message || 'Something went wrong. Try refreshing.'}
      onRetry={reset}
    />
  )
}
