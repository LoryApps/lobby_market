'use client'

import { PageError } from '@/components/ui/PageError'

export default function CalibrationLeaderboardError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load calibration board"
      description="Something went wrong loading the calibration leaderboard."
      reset={reset}
    />
  )
}
