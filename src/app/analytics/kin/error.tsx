'use client'
import { PageError } from '@/components/ui/PageError'

export default function KinAnalyticsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Civic Kin" />
}
