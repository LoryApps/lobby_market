import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HeatClient } from './HeatClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  const title = data
    ? `Heat Map · ${data.statement.slice(0, 60)}${data.statement.length > 60 ? '…' : ''} · Lobby Exchange`
    : 'Market Heat Map · Lobby Exchange'

  return {
    title,
    description:
      'Activity heat map for this civic prediction market — peak trading hours, hottest price zones, and most engaged arguments.',
    robots: { index: false },
    openGraph: {
      title,
      description:
        'When does this market run hot? See the activity grid, vote-volume calendar, and top arguments by engagement velocity.',
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default async function HeatPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <HeatClient id={params.id} />
}
