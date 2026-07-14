'use client'

import { PageError } from '@/components/ui/PageError'

export default function CommitteeDetailError({ reset }: { reset: () => void }) {
  return <PageError reset={reset} />
}
