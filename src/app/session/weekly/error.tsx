'use client'

import { PageError } from '@/components/ui/PageError'

export default function WeeklySessionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Weekly summit unavailable"
      description="The weekly civic summit couldn't be loaded right now. Please try again."
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
