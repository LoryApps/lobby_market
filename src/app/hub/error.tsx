'use client'

import { PageError } from '@/components/ui/PageError'

export default function HubError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Hub unavailable" onRetry={reset} />
}
