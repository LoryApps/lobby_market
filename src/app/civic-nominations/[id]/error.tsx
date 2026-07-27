'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicNominationError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/civic-nominations" backLabel="Back to Nominations" />
}
