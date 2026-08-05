'use client'

import { PageError } from '@/components/ui/PageError'

export default function SwingError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Could not load swing data"
      description="Something went wrong loading civic swing data. Please try again."
      onReset={reset}
    />
  )
}
