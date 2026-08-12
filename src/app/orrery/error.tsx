'use client'

import { PageError } from '@/components/ui/PageError'

export default function OrreryError({ reset }: { reset: () => void }) {
  return <PageError title="Orrery unavailable" onRetry={reset} />
}
