'use client'
import { PageError } from '@/components/ui/PageError'
export default function MinisterialStatementsError({ reset }: { reset: () => void }) {
  return <PageError title="Ministerial Statements unavailable" onRetry={reset} />
}
