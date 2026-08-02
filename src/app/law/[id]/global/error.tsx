'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawGlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError title="Global context unavailable" message={error.message} onRetry={reset} />
}
