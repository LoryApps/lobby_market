import type { Metadata } from 'next'
import { FlashpointClient } from './FlashpointClient'

export const metadata: Metadata = {
  title: 'Civic Flashpoint · Lobby Market',
  description:
    'The single most contested debate raging on Lobby Market right now — the highest-velocity, most polarised civic question of the moment.',
  openGraph: {
    title: 'Civic Flashpoint · Lobby Market',
    description:
      'One debate. Peak velocity. Maximum contest. The single hottest civic question happening right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Flashpoint · Lobby Market',
    description: 'The single most contested debate on Lobby Market — live, real-time, right now.',
  },
}

export default function FlashpointPage() {
  return <FlashpointClient />
}
