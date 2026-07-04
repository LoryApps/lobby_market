'use client'

import { PageError } from '@/components/ui/PageError'

export default function TurbulenceError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={_error}
      reset={reset}
      page="Turbulence"
    />
  )
}
