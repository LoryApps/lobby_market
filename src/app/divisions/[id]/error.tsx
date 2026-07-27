'use client'

import { PageError } from '@/components/ui/PageError'

export default function DivisionDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/divisions" backLabel="Back to Divisions" />
}
