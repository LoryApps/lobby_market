'use client'

import { PageError } from '@/components/ui/PageError'

export default function CatalystError({
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
      page="The Civic Catalyst"
      backHref="/"
      backLabel="Home"
    />
  )
}
