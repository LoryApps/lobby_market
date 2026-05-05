'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawTodayError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Law of the Day" />
}
