import type { Metadata } from 'next'
import { ThesisBattleClient } from './ThesisBattleClient'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

export const metadata: Metadata = {
  title: 'Thesis Faceoff · Lobby Market',
  description:
    'Two civic predictions enter — you decide. Vote agree or disagree on competing theses and see how your instincts compare to the crowd.',
  openGraph: {
    title: 'Thesis Faceoff · Lobby Market',
    description:
      'Head-to-head civic predictions. Two theses, one vote — agree or disagree on each and see where you stand.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [
      {
        url: `${BASE_URL}/assets/og-share.png`,
        width: 1200,
        height: 630,
        alt: 'Thesis Faceoff — civic predictions battle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thesis Faceoff · Lobby Market',
    description: 'Two civic theses head to head. Vote on each and see how your civic mind compares.',
  },
}

export default function ThesisBattlePage() {
  return <ThesisBattleClient />
}
