'use client'

import { PageError } from '@/components/ui/PageError'

export default function PromptArchiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Prompt Archive" />
}
