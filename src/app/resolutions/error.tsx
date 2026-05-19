'use client'

import { PageError } from '@/components/ui/PageError'

export default function ResolutionsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError title="Couldn't load resolutions" message={error.message} onRetry={reset} />
}
