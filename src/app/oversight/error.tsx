'use client'
import { PageError } from '@/components/ui/PageError'
export default function OversightError({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError message={error.message} reset={reset} />
}
