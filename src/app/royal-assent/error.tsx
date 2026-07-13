'use client'

import { PageError } from '@/components/ui/PageError'

export default function RoyalAssentError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="The Chamber is Sealed"
      description="The Royal Assent chamber could not be reached. Please try again."
      onRetry={reset}
    />
  )
}
