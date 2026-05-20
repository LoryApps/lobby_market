'use client'

import { PageError } from '@/components/ui/PageError'

export default function InsightsError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Could not load insights"
      description="There was an error fetching platform data. Please try again."
      onRetry={reset}
    />
  )
}
