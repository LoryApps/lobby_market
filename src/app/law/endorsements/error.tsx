'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawEndorsementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Couldn't load endorsements" message={error.message} onRetry={reset} />
}
