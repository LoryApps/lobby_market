'use client'

import { PageError } from '@/components/ui/PageError'

export default function ReplayError({ reset }: { reset: () => void }) {
  return <PageError label="Couldn't load replay" onRetry={reset} />
}
