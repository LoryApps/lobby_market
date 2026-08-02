import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawArgumentsClient } from './LawArgumentsClient'
import type { LawArgumentsResponse } from '@/app/api/laws/[id]/arguments/route'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Founding Arguments · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Founding Arguments: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Browse the FOR and AGAINST arguments from the civic debate that established this law — ${forPct}% For · ${(law.total_votes ?? 0).toLocaleString()} votes cast${law.category ? ` · ${law.category}` : ''}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: { canonical: `https://lobby.market/law/${params.id}/arguments` },
  }
}

export default async function LawArgumentsPage({ params }: Props) {
  const supabase = await createClient()

  const [lawResult, userResult] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!lawResult.data) notFound()

  const law = lawResult.data
  const currentUserId = userResult.data.user?.id ?? null

  let initialArguments: TopicArgumentWithAuthor[] = []
  let totalFor = 0
  let totalAgainst = 0

  if (law.topic_id) {
    const { data: rawArgs } = await supabase
      .from('topic_arguments')
      .select('*')
      .eq('topic_id', law.topic_id)
      .order('upvotes', { ascending: false })
      .limit(100)

    if (rawArgs && rawArgs.length > 0) {
      const userIds = Array.from(new Set(rawArgs.map((a) => a.user_id)))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p])
      )

      const argIds = rawArgs.map((a) => a.id)

      const upvotedSet = new Set<string>()
      if (currentUserId) {
        const { data: votes } = await supabase
          .from('topic_argument_votes')
          .select('argument_id')
          .in('argument_id', argIds)
          .eq('user_id', currentUserId)
        for (const v of votes ?? []) upvotedSet.add(v.argument_id)
      }

      const replyCounts = new Map<string, number>()
      const { data: replies } = await supabase
        .from('argument_replies')
        .select('argument_id')
        .in('argument_id', argIds)
      for (const r of replies ?? []) {
        replyCounts.set(r.argument_id, (replyCounts.get(r.argument_id) ?? 0) + 1)
      }

      initialArguments = rawArgs.map((a) => ({
        ...a,
        side: a.side as 'blue' | 'red',
        author: profileMap.get(a.user_id) ?? null,
        has_upvoted: upvotedSet.has(a.id),
        reply_count: replyCounts.get(a.id) ?? 0,
      }))

      totalFor = rawArgs.filter((a) => a.side === 'blue').length
      totalAgainst = rawArgs.filter((a) => a.side === 'red').length
    }
  }

  const initialData: LawArgumentsResponse = {
    arguments: initialArguments,
    law: {
      id: law.id,
      statement: law.statement ?? '',
      category: law.category ?? null,
      established_at: law.established_at ?? null,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      topic_id: law.topic_id ?? null,
    },
    totalFor,
    totalAgainst,
  }

  return (
    <LawArgumentsClient
      lawId={params.id}
      initialData={initialData}
      currentUserId={currentUserId}
    />
  )
}
