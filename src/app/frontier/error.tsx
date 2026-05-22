'use client'

import { PageError } from '@/components/ui/PageError'

export default function FrontierError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Frontier unavailable" message={error.message} onRetry={reset} />
}
