import type { Metadata } from 'next'
import { StanceMapClient } from './StanceMapClient'

export const metadata: Metadata = {
  title: 'Coalition Stance Map · Lobby Market',
  description:
    'See where every coalition stands across all civic categories — a heatmap of political alignment showing which factions support, oppose, or sit on the fence across Economics, Environment, Technology, and more.',
  openGraph: {
    title: 'Coalition Stance Map · Lobby Market',
    description:
      'The ideological landscape of the Lobby — which coalitions are FOR or AGAINST each civic category. Blue = for, Red = against.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coalition Stance Map · Lobby Market',
    description:
      'Heatmap of coalition stances across all 10 civic categories. Where do the factions really stand?',
  },
}

export default function StanceMapPage() {
  return <StanceMapClient />
}
