'use client'

import { PageError } from '@/components/ui/PageError'

export default function SignalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Signal unavailable" message={error.message} reset={reset} />
}
