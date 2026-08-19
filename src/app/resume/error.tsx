'use client'

import { PageError } from '@/components/ui/PageError'

export default function ResumeError({ reset }: { reset: () => void }) {
  return <PageError title="Resume unavailable" description="We couldn't load your civic resume." reset={reset} />
}
