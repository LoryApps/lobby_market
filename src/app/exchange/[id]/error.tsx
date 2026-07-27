'use client'

import { PageError } from '@/components/ui/PageError'

export default function MarketDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/exchange" backLabel="Back to Exchange" />
}
