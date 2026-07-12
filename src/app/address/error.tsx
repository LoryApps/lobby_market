'use client'

import { PageError } from '@/components/ui/PageError'

export default function AddressError({ reset }: { reset: () => void }) {
  return <PageError title="Address Unavailable" description="Could not load the State of the Lobby address." onRetry={reset} />
}
