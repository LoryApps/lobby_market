'use client'

import { ErrorCard } from '@/components/ui/ErrorCard'

export default function MissionsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorCard title="Couldn't load missions" onReset={reset} />
}
