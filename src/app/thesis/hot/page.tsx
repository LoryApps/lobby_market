import type { Metadata } from 'next'
import { HotThesesClient } from './HotThesesClient'

export const metadata: Metadata = {
  title: 'Hot Theses · Lobby Market',
  description:
    'The most debated, most contested, and most urgent civic theses on Lobby Market — curated discovery for the sharpest predictions.',
  openGraph: {
    title: 'Hot Theses · Lobby Market',
    description: 'Discover the most debated and contested civic theses.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Hot Theses · Lobby Market',
    description: 'The most debated civic predictions on Lobby Market.',
  },
}

export default function HotThesesPage() {
  return <HotThesesClient />
}
