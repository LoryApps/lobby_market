'use client'

import { AlertTriangle } from 'lucide-react'
import { PageError } from '@/components/ui/PageError'

export default function CivicPetitionsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <PageError
      icon={AlertTriangle}
      title="Failed to load petitions"
      description="Something went wrong loading civic petitions. Please try again."
      onRetry={reset}
    />
  )
}
