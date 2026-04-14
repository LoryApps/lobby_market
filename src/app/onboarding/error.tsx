'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[OnboardingError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <ErrorCard
        title="Onboarding unavailable"
        message="There was a problem starting the onboarding flow. Please refresh to try again."
        digest={error.digest}
        onReset={reset}
      />
    </div>
  )
}
