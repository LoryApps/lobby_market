'use client'

import { PageError } from '@/components/ui/PageError'

export default function ReputationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} />
}
