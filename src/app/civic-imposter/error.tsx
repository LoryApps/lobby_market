'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicImposterError({ reset }: { reset: () => void }) {
  return <PageError title="Imposter unavailable" description="Couldn't load today's challenge. Try again." onRetry={reset} />
}
