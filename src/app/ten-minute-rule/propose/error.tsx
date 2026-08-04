'use client'

import { PageError } from '@/components/ui/PageError'

export default function ProposeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Proposal form unavailable"
      description="The ten-minute rule proposal form couldn't be loaded. Please try again."
      backHref="/ten-minute-rule"
      backLabel="Back"
    />
  )
}
