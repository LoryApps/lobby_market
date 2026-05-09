'use client'

import { PageError } from '@/components/ui/PageError'

export default function GauntletError({ reset }: { reset: () => void }) {
  return <PageError title="Gauntlet unavailable" description="Couldn't load rounds. Try again." onRetry={reset} />
}
