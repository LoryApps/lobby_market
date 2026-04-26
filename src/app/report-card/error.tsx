'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ReportCardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <ErrorCard
        title="Report card failed to load"
        message="Something went wrong loading your civic report card."
        onReset={reset}
      />
    </div>
  )
}
