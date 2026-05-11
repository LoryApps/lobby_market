'use client'

import { PageError } from '@/components/ui/PageError'

export default function WordCloudError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      page="Platform Lexicon"
      backHref="/arguments"
      backLabel="Back to arguments"
    />
  )
}
