'use client'

import { PageError } from '@/components/ui/PageError'

export default function CreateSeriesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Create series unavailable"
      description="The debate series creator couldn't be loaded right now. Please try again."
      backHref="/debate"
      backLabel="Back to debates"
    />
  )
}
