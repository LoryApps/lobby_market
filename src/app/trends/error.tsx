'use client'

import { PageError } from '@/components/ui/PageError'

export default function TrendsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="trends" backHref="/" backLabel="Back to feed" />
}
