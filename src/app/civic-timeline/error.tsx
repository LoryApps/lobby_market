'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicTimelineError({ reset }: { reset: () => void }) {
  return <PageError title="Civic Timeline unavailable" description="Couldn't load today's rounds. Try again." onRetry={reset} />
}
