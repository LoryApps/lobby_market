'use client'

import { PageError } from '@/components/ui/PageError'

export default function BriefingError({ reset }: { reset: () => void }) {
  return <PageError title="Briefing unavailable" message="We couldn't load your daily briefing." onRetry={reset} />
}
