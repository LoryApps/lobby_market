'use client'

import { PageError } from '@/components/ui/PageError'

export default function BattlegroundError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PageError error={error} reset={reset} page="Battleground" />
}
