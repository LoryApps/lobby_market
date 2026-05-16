'use client'

import { PageError } from '@/components/ui/PageError'

export default function CloutAnalyticsError({ reset }: { reset: () => void }) {
  return <PageError title="Clout analytics unavailable" onRetry={reset} />
}
