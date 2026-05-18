'use client'

import { PageError } from '@/components/ui/PageError'

export default function SummitError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Summit Error" message={error.message} onReset={reset} />
}
