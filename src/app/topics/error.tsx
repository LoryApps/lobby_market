'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      title="Could not load topics"
      description="The topic browser failed to load. Try again in a moment."
      onRetry={reset}
    />
  )
}
