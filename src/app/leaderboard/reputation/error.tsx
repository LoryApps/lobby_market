'use client'

import { PageError } from '@/components/ui/PageError'

export default function ReputationLeaderboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Reputation Leaderboard unavailable"
      description={error.message}
      reset={reset}
    />
  )
}
