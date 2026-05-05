'use client'

import { PageError } from '@/components/ui/PageError'

export default function SavedArgumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Saved Arguments" />
}
