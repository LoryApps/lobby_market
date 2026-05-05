'use client'

import { PageError } from '@/components/ui/PageError'

export default function ReasonsError({
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
      page="Vote Reasons"
      backHref="/hot-takes"
      backLabel="All hot takes"
    />
  )
}
