'use client'

import { PageError } from '@/components/ui/PageError'

export default function RelayDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/relays" backLabel="Back to Relays" />
}
