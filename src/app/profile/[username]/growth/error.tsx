'use client'

import { PageError } from '@/components/ui/PageError'

export default function ProfileGrowthError({ reset }: { reset: () => void }) {
  return <PageError message="Could not load civic growth data." onRetry={reset} />
}
