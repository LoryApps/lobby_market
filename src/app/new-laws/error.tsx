'use client'

import { PageError } from '@/components/ui/PageError'

export default function NewLawsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Couldn't load new laws"
      description={error.message ?? 'Something went wrong loading recently established laws.'}
      onRetry={reset}
    />
  )
}
