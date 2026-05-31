'use client'

import { PageError } from '@/components/ui/PageError'

export default function UncertaintyError({ reset }: { reset: () => void }) {
  return <PageError title="Failed to load Uncertainty Index" onRetry={reset} />
}
