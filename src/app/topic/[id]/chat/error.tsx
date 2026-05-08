'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicChatError({
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
      page="Topic Chat"
      backHref="/"
      backLabel="Back to home"
    />
  )
}
