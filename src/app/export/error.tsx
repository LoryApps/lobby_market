'use client'

import { PageError } from '@/components/ui/PageError'

export default function ExportError({
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
      page="Data Export"
      backHref="/settings"
      backLabel="Back to settings"
    />
  )
}
