'use client'

import { PageError } from '@/components/ui/PageError'

export default function SparkError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Civic Spark" />
}
