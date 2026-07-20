import type { Metadata } from 'next'
import { ProposalDetailClient } from './ProposalDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobbymarket.app'
    const res = await fetch(`${base}/api/exchange/proposals/${params.id}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      return {
        title: `${data.title} · Market Proposal`,
        description:
          data.description ??
          `Community proposal for a new civic prediction market — ${data.upvotes} upvotes.`,
        openGraph: {
          title: `${data.title} · Lobby Exchange`,
          description:
            data.description ??
            `Community proposal for a new civic prediction market.`,
          type: 'website',
          siteName: 'Lobby Market',
        },
        twitter: {
          card: 'summary',
          title: `${data.title} · Lobby Exchange`,
        },
      }
    }
  } catch {
    // fall through to defaults
  }
  return {
    title: 'Market Proposal · Lobby Exchange',
    description: 'View this community proposal for a new civic prediction market.',
  }
}

export default function ProposalDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <ProposalDetailClient proposalId={params.id} />
}
