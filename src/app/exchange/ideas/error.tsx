'use client'

import { PageError } from '@/components/ui/PageError'

export default function IdeasError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError title="Market Ideas unavailable" error={error.message} onRetry={reset} />
}
