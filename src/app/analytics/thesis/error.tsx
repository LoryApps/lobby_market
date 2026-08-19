'use client'

import { PageError } from '@/components/ui/PageError'

export default function ThesisAnalyticsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError title="Couldn't load thesis analytics" message={error.message} onRetry={reset} />
}
