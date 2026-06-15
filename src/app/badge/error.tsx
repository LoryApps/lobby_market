'use client'

import { PageError } from '@/components/ui/PageError'

export default function BadgeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Badge Unavailable" message={error.message} onRetry={reset} />
}
