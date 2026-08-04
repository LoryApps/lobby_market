'use client'

import { PageError } from '@/components/ui/PageError'

export default function FindDelegateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Delegate finder unavailable"
      description="The delegate finder couldn't be loaded right now. Please try again."
      backHref="/delegate"
      backLabel="Back to delegates"
    />
  )
}
