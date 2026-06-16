'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { reset: () => void }) {
  return <PageError title="Couldn't load highlights" onRetry={reset} />
}
