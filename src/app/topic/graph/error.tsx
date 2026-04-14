'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function TopicGraphError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[TopicGraphError]', error)
  }, [error])

  return (
    <div className="h-screen bg-surface-50 flex items-center justify-center p-4">
      <ErrorCard
        title="Couldn't load the topic graph"
        message="There was a problem rendering the topic network. Please try again."
        digest={error.digest}
        onReset={reset}
      />
    </div>
  )
}
