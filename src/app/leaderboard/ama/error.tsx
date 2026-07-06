'use client'

import { PageError } from '@/components/ui/PageError'

export default function AMALeaderboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Failed to load AMA rankings" onRetry={reset} />
}
