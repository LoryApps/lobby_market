'use client'

import { PageError } from '@/components/ui/PageError'

export default function ClimateError({ reset }: { reset: () => void }) {
  return <PageError title="Couldn't load civic climate" onRetry={reset} />
}
