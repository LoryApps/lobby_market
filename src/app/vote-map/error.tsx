'use client'
import { PageError } from '@/components/ui/PageError'

export default function VoteMapError({ reset }: { reset: () => void }) {
  return <PageError title="Scope Map unavailable" onRetry={reset} />
}
