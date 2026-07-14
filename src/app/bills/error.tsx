'use client'

import { PageError } from '@/components/ui/PageError'

export default function BillsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Could not load bills" message={error.message} onRetry={reset} />
}
