'use client'

import { useEffect } from 'react'
import { PageError } from '@/components/ui/PageError'

export default function GemsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <PageError message="Failed to load Civic Gems." reset={reset} />
}
