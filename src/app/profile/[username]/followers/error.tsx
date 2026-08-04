'use client'

import { PageError } from '@/components/ui/PageError'

export default function FollowersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load followers"
      description={error.message || 'Something went wrong fetching this list.'}
      onRetry={reset}
    />
  )
}
