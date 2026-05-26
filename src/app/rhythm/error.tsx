'use client'

import { PageError } from '@/components/ui/PageError'

export default function RhythmError({ reset }: { reset: () => void }) {
  return (
    <PageError
      title="Rhythm unavailable"
      description="Could not load temporal activity data."
      onReset={reset}
    />
  )
}
