import type { Metadata } from 'next'
import { ThesisMapClient } from './ThesisMapClient'

const BASE = 'https://lobbymarket.com'

export const metadata: Metadata = {
  title: 'Thesis Map | Lobby Market',
  description:
    'Interactive 2D scatter plot of all active civic predictions — plotted by consensus (agree ratio) versus urgency (days until resolution).',
  openGraph: {
    title: 'Thesis Map | Lobby Market',
    description:
      'See where civic predictions cluster: landslide consensus or razor-thin splits, urgent or long-horizon.',
    url: `${BASE}/thesis/map`,
    siteName: 'Lobby Market',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thesis Map | Lobby Market',
    description:
      'Interactive scatter plot of active civic predictions by agreement vs. urgency.',
  },
  alternates: {
    canonical: `${BASE}/thesis/map`,
  },
}

export default function ThesisMapPage() {
  return <ThesisMapClient />
}
