'use client'

import { PageError } from '@/components/ui/PageError'

export default function AcademyError({ reset }: { reset: () => void }) {
  return <PageError title="Academy unavailable" onRetry={reset} />
}
