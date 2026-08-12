'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicImpactError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError message={error.message} onRetry={reset} />
}
