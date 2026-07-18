import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IdeaDetailClient } from './IdeaDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('market_ideas')
      .select(`
        title, body, direction, target_price, confidence,
        upvotes, downvotes,
        author:profiles!user_id(username, display_name),
        topic:topics(statement, category, blue_pct)
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (!data) return { title: 'Market Idea · Lobby Exchange' }

    const author  = Array.isArray(data.author) ? data.author[0] : data.author
    const topic   = Array.isArray(data.topic)  ? data.topic[0]  : data.topic
    const name    = (author as { display_name?: string | null; username: string } | null)?.display_name
                 ?? (author as { username: string } | null)?.username
                 ?? 'Unknown'
    const dir     = (data.direction as string) === 'for'     ? '↑ FOR'
                  : (data.direction as string) === 'against' ? '↓ AGAINST'
                  : '→ NEUTRAL'
    const price   = topic ? Math.round((topic as { blue_pct: number | null }).blue_pct ?? 50) : null
    const target  = data.target_price

    const title = `${data.title} · ${dir} · Lobby Exchange`
    const description = [
      `${name}'s market thesis: "${(data.body as string).slice(0, 120)}…"`,
      target != null ? `Target price: ${target}¢` : null,
      price  != null ? `Current price: ${price}¢`  : null,
      `${(data.upvotes as number) - (data.downvotes as number)} net votes`,
    ].filter(Boolean).join(' · ')

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        siteName: 'Lobby Market',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      robots: { index: false },
    }
  } catch {
    return { title: 'Market Idea · Lobby Exchange' }
  }
}

export default async function IdeaDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('market_ideas')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <IdeaDetailClient id={params.id} />
}
