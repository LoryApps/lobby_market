import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CertificateClient } from './CertificateClient'
import type { CertificateData } from './CertificateClient'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

interface PageProps {
  params: { lawId: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.lawId)
    .maybeSingle()

  if (!law) {
    return { title: 'Certificate · Lobby Market' }
  }

  const forPct = Math.round(law.blue_pct)
  const title = `Civic Certificate: ${law.statement.slice(0, 70)}`
  const description =
    `Established law on Lobby Market — ${forPct}% FOR · ` +
    `${law.total_votes.toLocaleString()} citizens voted · ` +
    `${law.category ?? 'Civic'} policy`

  const ogImageUrl = `${BASE_URL}/api/og/certificate/${params.lawId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: law.statement }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CertificatePage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Fetch the law
  const { data: law } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.lawId)
    .maybeSingle()

  if (!law) notFound()

  // 2. Get current user
  const { data: { user } } = await supabase.auth.getUser()

  let voterData: CertificateData['voter'] = null

  if (user) {
    // 3. Fetch the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', user.id)
      .maybeSingle()

    // 4. Fetch the user's vote on the original topic
    const { data: vote } = await supabase
      .from('votes')
      .select('side, reason, created_at')
      .eq('user_id', user.id)
      .eq('topic_id', law.topic_id)
      .maybeSingle()

    // 5. Calculate approximate vote rank (how early did they vote?)
    let voteRank: number | null = null
    if (vote) {
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', law.topic_id)
        .lt('created_at', vote.created_at)

      voteRank = count !== null ? count + 1 : null
    }

    voterData = {
      username: profile?.username ?? 'citizen',
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: profile?.role ?? 'person',
      votedSide: vote ? (vote.side === 'blue' ? 'blue' : 'red') : null,
      votedAt: vote?.created_at ?? null,
      reason: vote?.reason ?? null,
      voteRank,
      totalVoters: law.total_votes,
    }
  }

  const certData: CertificateData = {
    law: {
      id: law.id,
      topicId: law.topic_id,
      statement: law.statement,
      category: law.category,
      establishedAt: law.established_at,
      bluePct: law.blue_pct,
      totalVotes: law.total_votes,
    },
    voter: voterData,
  }

  return <CertificateClient data={certData} />
}
