import type { Metadata } from 'next'
import { CommitteeDetailClient } from './CommitteeDetailClient'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params: _params }: Props): Promise<Metadata> {
  return {
    title: `Select Committee · Lobby Market`,
    description: `A standing Select Committee scrutinising civic policy on Lobby Market. Follow inquiries and submit evidence.`,
    openGraph: {
      title: `Select Committee · Lobby Market`,
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default function CommitteeDetailPage({ params }: Props) {
  return <CommitteeDetailClient slug={params.slug} />
}
