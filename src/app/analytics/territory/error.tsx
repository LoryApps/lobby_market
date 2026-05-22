'use client'

import { PageError } from '@/components/ui/PageError'

export default function TerritoryError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError title="Territory Map failed to load" reset={reset} />
}
