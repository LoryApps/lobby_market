'use client'

import { Swords } from 'lucide-react'
import { PageError } from '@/components/ui/PageError'

export default function ClashError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      icon={Swords}
      title="Clash unavailable"
      description="The argument battles couldn't load. Check your connection and try again."
      error={error}
      reset={reset}
    />
  )
}
