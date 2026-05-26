'use client'

import { PageError } from '@/components/ui/PageError'

export default function FrontlinesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Frontlines unavailable" error={error} reset={reset} />
}
