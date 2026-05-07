'use client'

import { PageError } from '@/components/ui/PageError'

export default function TagGraphError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Couldn't load tag network"
      description="Something went wrong building the graph. Try again."
      onRetry={reset}
    />
  )
}
