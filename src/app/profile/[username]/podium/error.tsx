'use client'

import { PageError } from '@/components/ui/PageError'

export default function PodiumError({ reset }: { reset: () => void }) {
  return <PageError message="Could not load podium history." onRetry={reset} />
}
