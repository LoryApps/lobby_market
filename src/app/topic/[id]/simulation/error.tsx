'use client'

import { PageError } from '@/components/ui/PageError'

export default function TopicSimulationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} label="Couldn't load the simulator" />
}
