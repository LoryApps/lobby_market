'use client'

import { PageError } from '@/components/ui/PageError'

export default function HourglassError({ reset }: { reset: () => void }) {
  return <PageError title="Hourglass unavailable" onRetry={reset} />
}
