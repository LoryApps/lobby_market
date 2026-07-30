'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawVotersError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError error={error} reset={reset} />
}
