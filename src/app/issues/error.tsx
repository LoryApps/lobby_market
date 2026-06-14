'use client'

import { PageError } from '@/components/ui/PageError'

export default function IssuesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError page="Civic Issues" error={error} reset={reset} />
}
