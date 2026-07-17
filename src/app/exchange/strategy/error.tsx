'use client'

import { PageError } from '@/components/ui/PageError'

export default function StrategyError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Strategy Monitor unavailable"
      description="Could not load live signals. The exchange may be temporarily unavailable."
      onRetry={reset}
    />
  )
}
