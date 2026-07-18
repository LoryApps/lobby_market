'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Could not load Top Calls"
      description="We ran into an issue fetching resolved market predictions. Please try again."
      onRetry={reset}
    />
  )
}
