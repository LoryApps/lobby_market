'use client'

import { PageError } from '@/components/ui/PageError'

export default function FluxError({ reset }: { reset: () => void }) {
  return <PageError title="Couldn't load flux data" onRetry={reset} />
}
