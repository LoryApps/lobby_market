'use client'

import { PageError } from '@/components/ui/PageError'

export default function GrandCouncilError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} />
}
