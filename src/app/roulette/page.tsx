import type { Metadata } from 'next'
import { RouletteClient } from './RouletteClient'

export const metadata: Metadata = {
  title: 'Topic Roulette · Lobby Market',
  description:
    'Spin the wheel and discover a civic debate you haven\'t seen yet. Vote FOR or AGAINST, then spin again — every topic is a new conversation.',
  openGraph: {
    title: 'Topic Roulette · Lobby Market',
    description:
      'Random topic discovery for the Lobby. One spin, one debate, one vote. Break out of your filter bubble.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Topic Roulette · Lobby Market',
    description: 'Discover civic debates you haven\'t voted on yet — one random topic at a time.',
  },
}

export default function RoulettePage() {
  return <RouletteClient />
}
