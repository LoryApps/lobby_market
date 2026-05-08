'use client'

import { PageError } from '@/components/ui/PageError'

export default function ShareLawError({
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
      page="Share Law"
      backHref="/law"
      backLabel="Back to laws"
    />
  )
}
