'use client'

import { PageError } from '@/components/ui/PageError'

export default function CommitteesError({ reset }: { reset: () => void }) {
  return <PageError reset={reset} />
}
