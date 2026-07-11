import type { Metadata } from 'next'
import { AlignClient } from './AlignClient'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent(params.username)
  return {
    title: `Civic Alignment with @${name} · Lobby Market`,
    description: `See how your voting history aligns with @${name} — topic-by-topic agreement rates, category breakdowns, and shared civic convictions.`,
    openGraph: {
      title: `Civic Alignment with @${name} · Lobby Market`,
      description: `Vote alignment analysis — where you agree, where you diverge, and how well @${name} would represent your voice.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Civic Alignment with @${name} · Lobby Market`,
      description: `How well does @${name} vote like you? Full alignment breakdown.`,
    },
  }
}

export default function AlignPage({ params }: Props) {
  return <AlignClient username={decodeURIComponent(params.username)} />
}
