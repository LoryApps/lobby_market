'use client'

import { PageError } from '@/components/ui/PageError'

export default function LedgerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="The Civic Ledger" backHref="/" backLabel="Home" />
}
