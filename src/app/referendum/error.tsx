'use client'

import { useEffect } from 'react'
import { Landmark } from 'lucide-react'
import { PageError } from '@/components/ui/PageError'

export default function ReferendumError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[referendum error]', error)
  }, [error])

  return (
    <PageError
      icon={Landmark}
      title="Referendum Chamber Unavailable"
      description="The referendum chamber failed to load. Please try again."
      onRetry={reset}
    />
  )
}
