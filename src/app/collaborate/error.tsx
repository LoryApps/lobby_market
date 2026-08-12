'use client'

import { PageError } from '@/components/ui/PageError'

export default function CollaborateError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError title="Couldn't load opportunities" error={error} reset={reset} />
}
