'use client'

import { PageError } from '@/components/ui/PageError'

export default function LawWikiError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Law Wiki unavailable"
      description="The law wiki couldn't be loaded right now. Your data is safe — please try again."
      backHref="/laws"
      backLabel="Back to laws"
    />
  )
}
