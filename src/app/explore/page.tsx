import type { Metadata } from 'next'
import { ExploreClient } from './ExploreClient'

export const metadata: Metadata = {
  title: 'Explore · Lobby Market',
  description:
    'Discover everything Lobby Market has to offer — from AI debate tools and civic games to analytics, laws, and community features. Your guide to the full platform.',
  openGraph: {
    title: 'Explore Lobby Market',
    description:
      'The complete map of Lobby Market: every tool, game, leaderboard, and community feature — all in one place.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Explore · Lobby Market',
    description: 'Discover every feature on Lobby Market — civic games, AI tools, analytics, and more.',
  },
}

export default function ExplorePage() {
  return <ExploreClient />
}
