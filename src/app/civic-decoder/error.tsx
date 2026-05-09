'use client'

import { PageError } from '@/components/ui/PageError'

export default function CivicDecoderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError message={error.message} reset={reset} />
}
