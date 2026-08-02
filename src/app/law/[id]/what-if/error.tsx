'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawWhatIfError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError title="What-If unavailable" message={error.message} onRetry={reset} />
}
