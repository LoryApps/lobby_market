'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { reset: () => void }) {
  return <PageError title="Failed to load conflicts" onRetry={reset} />
}
