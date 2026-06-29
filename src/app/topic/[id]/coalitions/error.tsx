'use client'

import { PageError } from '@/components/ui/PageError'

export default function CoalitionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Coalition Stances" backHref=".." backLabel="Back to topic" />
}
