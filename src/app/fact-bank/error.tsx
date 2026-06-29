'use client'

import { PageError } from '@/components/ui/PageError'

export default function FactBankError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError error={error} reset={reset} />
}
