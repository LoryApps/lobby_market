'use client'

import { PageError } from '@/components/ui/PageError'

export default function ChronicleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError message={error.message} onReset={reset} />
}
