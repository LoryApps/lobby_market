'use client'

import { PageError } from '@/components/ui/PageError'

export default function MyQAError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="My Q&A unavailable"
      description="Your Q&A couldn't be loaded right now. Please try again."
      backHref="/questions"
      backLabel="Back to questions"
    />
  )
}
