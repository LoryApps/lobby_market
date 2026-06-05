'use client'

import { PageError } from '@/components/ui/PageError'

export default function FractureError({
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
      page="The Civic Fracture"
      backHref="/"
      backLabel="Home"
    />
  )
}
