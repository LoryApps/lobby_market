'use client'

import { PageError } from '@/components/ui/PageError'

export default function ImpactLeaderboardError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Impact Leaderboard unavailable"
      description="Couldn't load the Civic Impact Leaderboard right now. Please try again."
      reset={reset}
    />
  )
}
