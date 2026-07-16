'use client'

import { PageError } from '@/components/ui/PageError'

export default function SectorDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      title="Failed to load sector"
      description={error.message ?? 'Something went wrong loading this sector report.'}
      reset={reset}
      backHref="/exchange/categories"
      backLabel="Back to Sectors"
    />
  )
}
