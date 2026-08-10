'use client'

import { PageError } from '@/components/ui/PageError'

export default function JourneyError({ reset }: { reset: () => void }) {
  return <PageError title="Journey unavailable" onRetry={reset} />
}
