'use client'

import { PageError } from '@/components/ui/PageError'

export default function StandingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="standings" backHref="/analytics" backLabel="Back to analytics" />
}
