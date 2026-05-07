'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load Tag Radar" onRetry={reset} />
}
