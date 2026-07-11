'use client'

import { PageError } from '@/components/ui/PageError'

export default function BracketError({ reset }: { reset: () => void }) {
  return <PageError title="Bracket unavailable" onRetry={reset} />
}
