'use client'

import { PageError } from '@/components/ui/PageError'

export default function Error({ reset }: { reset: () => void }) {
  return <PageError message="Couldn't load network laws." onRetry={reset} />
}
