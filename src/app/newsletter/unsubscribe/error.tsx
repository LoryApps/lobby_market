'use client'

import { PageError } from '@/components/ui/PageError'

export default function UnsubscribeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Unsubscribe failed"
      description="We couldn't process your unsubscribe request right now. Please try again or contact support."
      backHref="/"
      backLabel="Back to feed"
    />
  )
}
