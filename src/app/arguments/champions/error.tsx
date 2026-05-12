'use client'

import { PageError } from '@/components/ui/PageError'

export default function ArenaChampionsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError title="Arena Champions" error={error} reset={reset} />
}
