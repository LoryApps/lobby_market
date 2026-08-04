'use client'

import { PageError } from '@/components/ui/PageError'

export default function IdeasLeaderboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Leaderboard unavailable"
      description="The ideas leaderboard couldn't be loaded. Please try again."
      backHref="/exchange"
      backLabel="Back to exchange"
    />
  )
}
