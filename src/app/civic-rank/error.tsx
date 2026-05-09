'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicRankError({ reset }: { reset: () => void }) {
  return <PageError title="Civic Rank unavailable" description="Couldn't load today's rounds. Try again." onRetry={reset} />
}
