import type { Metadata } from 'next'
import { FlipClient } from './FlipClient'

export const metadata: Metadata = {
  title: 'The Big Flip · Lobby Market',
  description:
    'Debates that defied the early odds — topics where the leading side collapsed, or underdogs came from behind to become law. The most dramatic vote reversals in the Lobby.',
  openGraph: {
    title: 'The Big Flip · Lobby Market',
    description:
      'Which debates turned upside down? Explore the biggest vote reversals — from crushing leads that evaporated to impossible comebacks that became law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Big Flip · Lobby Market',
    description: 'The most dramatic vote reversals in the Lobby — leads that collapsed, underdogs that won.',
  },
}

export default function FlipPage() {
  return <FlipClient />
}
