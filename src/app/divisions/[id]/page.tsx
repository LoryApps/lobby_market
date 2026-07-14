import type { Metadata } from 'next'
import { DivisionDetailClient } from './DivisionDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(_: { params: { id: string } }): Promise<Metadata> {
  return {
    title: 'Division · Lobby Market',
    description: 'View the full record of this parliamentary division — motion text, Aye and No lobbies, and the formal result.',
    openGraph: {
      title: 'Parliamentary Division · Lobby Market',
      description: 'Walk through the Aye or No lobby. Every division is permanently recorded.',
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default function DivisionDetailPage({ params }: { params: { id: string } }) {
  return <DivisionDetailClient id={params.id} />
}
