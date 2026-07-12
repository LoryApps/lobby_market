'use client'

import { PageError } from '@/components/ui/PageError'

export default function ShadowCabinetError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load the Shadow Cabinet"
      message={error.message ?? 'An unexpected error occurred.'}
      onRetry={reset}
    />
  )
}
