'use client'

import { PageError } from '@/components/ui/PageError'

export default function AmbassadorLeaderboardError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load ambassador rankings"
      description="Something went wrong loading the ambassador leaderboard."
      reset={reset}
    />
  )
}
