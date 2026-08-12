'use client'

import { PageError } from '@/components/ui/PageError'

export default function ClipsError({ reset }: { reset: () => void }) {
  return <PageError title="Clips unavailable" onRetry={reset} />
}
