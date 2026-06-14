'use client'

import { PageError } from '@/components/ui/PageError'

export default function ProfileTimelineError({ reset }: { reset: () => void }) {
  return <PageError message="Could not load civic timeline." onRetry={reset} />
}
