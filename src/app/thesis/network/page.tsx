import type { Metadata } from 'next'
import { ThesisNetworkView } from './ThesisNetworkView'

const BASE = 'https://lobbymarket.com'

export const metadata: Metadata = {
  title: 'Thesis Network · Lobby Market',
  description:
    'An interactive D3 network graph of all civic theses on Lobby Market — connected by shared topics, common authors, and category clusters. See how civic predictions relate and cluster.',
  openGraph: {
    title: 'Thesis Network · Lobby Market',
    description:
      'The web of civic predictions: theses connected by shared topics, same authors, and category proximity. Click any node to read the full thesis.',
    url: `${BASE}/thesis/network`,
    siteName: 'Lobby Market',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thesis Network · Lobby Market',
    description:
      'Interactive network graph of all civic predictions — see how theses connect across topics, authors, and categories.',
  },
  alternates: {
    canonical: `${BASE}/thesis/network`,
  },
}

export default function ThesisNetworkPage() {
  return <ThesisNetworkView />
}
