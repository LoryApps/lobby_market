'use client'
import { PageError } from '@/components/ui/PageError'
export default function MinisterialStatementDetailError({ reset }: { reset: () => void }) {
  return <PageError title="Statement not found" onRetry={reset} />
}
