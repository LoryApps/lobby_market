'use client'

import { PageError } from '@/components/ui/PageError'

export default function ExchangeError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/" backLabel="Back to feed" />
}
