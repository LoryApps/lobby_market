'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicNominationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load Civic Nominations"
      description={error.message ?? 'Something went wrong loading the nominations board.'}
      onRetry={reset}
    />
  )
}
