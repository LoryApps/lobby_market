'use client'

import { PageError } from '@/components/ui/PageError'

export default function PrismError({
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
      page="The Civic Prism"
      backHref="/"
      backLabel="Home"
    />
  )
}
