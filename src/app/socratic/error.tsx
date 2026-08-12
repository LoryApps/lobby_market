'use client'

import { PageError } from '@/components/ui/PageError'

export default function SocraticError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Socratic Lobby error" message={error.message} onRetry={reset} />
}
