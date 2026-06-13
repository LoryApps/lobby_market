'use client'

import { PageError } from '@/components/ui/PageError'

export default function GazetteDateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} page="Civic Gazette" backHref="/gazette" />
}
