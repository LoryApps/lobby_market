'use client'

import { PageError } from '@/components/ui/PageError'

export default function GaugeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      page="Civic Gauge"
      backHref="/arcade"
      backLabel="Back to Arcade"
    />
  )
}
