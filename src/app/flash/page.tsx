import type { Metadata } from 'next'
import { FlashClient } from './FlashClient'

export const metadata: Metadata = {
  title: 'The Civic Flash · Lobby Market',
  description:
    'Flashpoints are topics where the voting majority and the argumentative community point in opposite directions — the platform\'s most contested intellectual tensions.',
  openGraph: {
    title: 'The Civic Flash · Lobby Market',
    description:
      'Where civic ballots clash with arguments. Topics where voters say one thing and debaters argue another.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Flash · Lobby Market',
    description: 'Discover topics where voting direction diverges from argument quality — the sharpest civic tensions.',
  },
}

export default function FlashPage() {
  return <FlashClient />
}
