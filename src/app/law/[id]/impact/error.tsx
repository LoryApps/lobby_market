'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawImpactError({
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
      page="Law Impact"
      backHref="/law"
      backLabel="Back to laws"
    />
  )
}
