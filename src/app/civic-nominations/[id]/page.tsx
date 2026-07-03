import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NominationDetailClient } from './NominationDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

const ROLE_LABELS: Record<string, string> = {
  grand_council:       'Grand Council Member',
  tribunal_judge:      'Tribunal Judge',
  fact_checker:        'Platform Fact Checker',
  debate_moderator:    'Debate Moderator',
  assembly_rapporteur: 'Assembly Rapporteur',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: nom } = await supabase
    .from('civic_nominations')
    .select(`
      role, reason, endorsement_count, endorsement_target, status,
      nominee:nominee_id ( username, display_name )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!nom) return { title: 'Nomination · Lobby Market' }

  const nominee = nom.nominee as { username: string; display_name: string | null } | null
  const name = nominee?.display_name ?? nominee?.username ?? 'Unknown'
  const roleLabel = ROLE_LABELS[nom.role] ?? nom.role
  const title = `${name} for ${roleLabel} · Lobby Market`
  const description = `${name} has been nominated for ${roleLabel} on Lobby Market. ${nom.endorsement_count} of ${nom.endorsement_target} endorsements. ${nom.reason.slice(0, 120)}${nom.reason.length > 120 ? '…' : ''}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function NominationDetailPage({ params }: Props) {
  const supabase = await createClient()

  const { data: nom, error } = await supabase
    .from('civic_nominations')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !nom) notFound()

  // Full data is fetched client-side to include auth-dependent fields
  return <NominationDetailClient nominationId={params.id} />
}
