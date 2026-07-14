import type { Metadata } from 'next'
import { TMRDetailClient } from './TMRDetailClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params: _params }: Props): Promise<Metadata> {
  return {
    title: `Ten Minute Rule Proposal · Lobby Market`,
    description: `A citizen's Ten Minute Rule bill proposal — read the speeches and vote on whether it should be formally introduced.`,
    openGraph: {
      title: `Ten Minute Rule Proposal · Lobby Market`,
      description: `Read the proposal and opposition speeches, then vote on whether this bill should be introduced into the chamber.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default function TMRDetailPage({ params }: Props) {
  return <TMRDetailClient id={params.id} />
}
