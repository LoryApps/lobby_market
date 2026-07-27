'use client'

import { PageError } from '@/components/ui/PageError'

export default function ProposalDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/exchange/proposals" backLabel="Back to Proposals" />
}
