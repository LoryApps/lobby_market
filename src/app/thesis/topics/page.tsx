import type { Metadata } from 'next'
import { ThesisTopicsClient } from './ThesisTopicsClient'

const BASE = 'https://lobbymarket.com'

export const metadata: Metadata = {
  title: 'Thesis Battlegrounds · Lobby Market',
  description:
    'Topics where civic predictions clash — browse debates with multiple competing theses and see where citizens are most divided on how history will unfold.',
  openGraph: {
    title: 'Thesis Battlegrounds · Lobby Market',
    description:
      'Where civic predictions collide: topics with multiple competing theses, ranked by controversy and community engagement.',
    url: `${BASE}/thesis/topics`,
    siteName: 'Lobby Market',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Battlegrounds · Lobby Market',
    description:
      'Debates with multiple competing civic predictions — see who disagrees and stake your own thesis.',
  },
  alternates: {
    canonical: `${BASE}/thesis/topics`,
  },
}

export default function ThesisTopicsPage() {
  return <ThesisTopicsClient />
}
