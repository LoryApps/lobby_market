import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BenchmarkClient } from './BenchmarkClient'

export const metadata: Metadata = {
  title: 'Civic Benchmark · Lobby Market',
  description:
    'See how your civic engagement compares to the rest of the platform — percentile rankings across votes, arguments, clout, streak, and reputation.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function BenchmarkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <BenchmarkClient />
}
