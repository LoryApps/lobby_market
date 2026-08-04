'use client'

import { PageError } from '@/components/ui/PageError'

export default function RecruitError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Recruit page unavailable"
      description="The coalition recruit page couldn't be loaded. Please try again."
      backHref="/coalitions"
      backLabel="Back to coalitions"
    />
  )
}
