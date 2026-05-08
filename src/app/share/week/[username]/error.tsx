'use client'

import { PageError } from '@/components/ui/PageError'

export default function ShareWeekError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      page="Weekly Recap"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
