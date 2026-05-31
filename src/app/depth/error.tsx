'use client'

import { PageError } from '@/components/ui/PageError'

export default function DepthError({ reset }: { reset: () => void }) {
  return <PageError reset={reset} />
}
