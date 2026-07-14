'use client'

import { PageError } from '@/components/ui/PageError'

export default function WrittenQuestionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} />
}
