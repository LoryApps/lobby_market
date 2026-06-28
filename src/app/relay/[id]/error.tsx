'use client'

import { PageError } from '@/components/ui/PageError'

export default function RelayDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      page="Relay"
      backHref="/relay"
      backLabel="Browse Relays"
    />
  )
}
