'use client'

import { PageError } from '@/components/ui/PageError'

export default function FaceoffError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Faceoff unavailable"
      description={error.message ?? 'Could not load the argument faceoff for this topic.'}
      onRetry={reset}
    />
  )
}
