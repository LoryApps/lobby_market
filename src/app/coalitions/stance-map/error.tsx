'use client'

import { PageError } from '@/components/ui/PageError'

export default function StanceMapError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError title="Stance Map Error" message={error.message} onRetry={reset} />
}
