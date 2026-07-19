import type { Metadata } from 'next'
import { GroupDetailClient } from './GroupDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/exchange/groups/${params.id}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return { title: 'Market Group · Lobby Exchange' }
    const g = await res.json() as { name?: string; description?: string; emoji?: string; item_count?: number }
    const title = `${g.emoji ?? '📊'} ${g.name ?? 'Market Group'} · Lobby Exchange`
    const description = g.description
      ?? `A curated basket of ${g.item_count ?? 0} civic prediction markets on Lobby Exchange.`
    return {
      title,
      description,
      robots: { index: g.name ? 'index' : 'noindex' },
      openGraph: { title, description, type: 'website', siteName: 'Lobby Market' },
      twitter: { card: 'summary', title, description },
    }
  } catch {
    return { title: 'Market Group · Lobby Exchange' }
  }
}

export default function GroupDetailPage({ params }: Props) {
  return <GroupDetailClient id={params.id} />
}
