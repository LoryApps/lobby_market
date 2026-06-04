import type { Metadata } from 'next'
import { EpicenterClient } from './EpicenterClient'

export const metadata: Metadata = {
  title: 'The Civic Epicenter · Lobby Market',
  description:
    'The most interconnected topics in the civic discourse — where wiki links, argument depth, and democratic participation converge. These are the load-bearing pillars of the Lobby.',
  openGraph: {
    title: 'The Civic Epicenter · Lobby Market',
    description:
      'Find the topics at the center of everything: the most wiki-linked, most argued, and most-voted debates that anchor the whole civic structure.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Epicenter · Lobby Market',
    description:
      'The load-bearing topics of civic discourse — ranked by wiki connectivity, argument depth, and democratic weight.',
  },
}

export default function EpicenterPage() {
  return <EpicenterClient />
}
