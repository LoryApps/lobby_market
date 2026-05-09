'use client'

import { PageError } from '@/components/ui/PageError'

export default function OddOneOutError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Couldn't load the puzzle"
      description="There was a problem generating today's Odd One Out challenge."
      onRetry={reset}
    />
  )
}
