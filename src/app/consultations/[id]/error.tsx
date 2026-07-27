'use client'

import { PageError } from '@/components/ui/PageError'

export default function ConsultationError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} backHref="/consultations" backLabel="Back to Consultations" />
}
