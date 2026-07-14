'use client'

import { PageError } from '@/components/ui/PageError'

export default function BillDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Could not load bill" message={error.message} onRetry={reset} />
}
