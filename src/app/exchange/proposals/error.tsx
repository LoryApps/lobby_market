'use client'

import { ErrorCard } from '@/components/ui/ErrorCard'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorCard message={error.message} onReset={reset} />
}
