'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicDispatchError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Dispatch offline"
      message="Unable to load the civic dispatch right now."
      reset={reset}
    />
  )
}
