'use client'

import { PageError } from '@/components/ui/PageError'

export default function FollowingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load following"
      description={error.message || 'Something went wrong fetching this list.'}
      onRetry={reset}
    />
  )
}
