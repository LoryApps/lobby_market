'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawHealthError({ reset }: { reset: () => void }) {
  return <PageError title="Couldn't load health report" onRetry={reset} />
}
