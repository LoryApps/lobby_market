'use client'

import { PageError } from '@/components/ui/PageError'

export default function TensionsError({ reset }: { reset: () => void }) {
  return <PageError title="Failed to load Civic Tensions" onReset={reset} />
}
