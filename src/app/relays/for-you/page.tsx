import type { Metadata } from 'next'
import { ForYouRelaysClient } from './ForYouRelaysClient'

export const metadata: Metadata = {
  title: 'Relays For You · Lobby Market',
  description:
    'Personalized relay chain recommendations based on your voting history, followed tags, and civic activity. Add your voice to chains that match your interests.',
  openGraph: {
    title: 'Relays For You · Lobby Market',
    description:
      'Relay chains picked for you — add your argument leg to civic chains that match your interests.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relays For You · Lobby Market',
    description: 'Personalized relay recommendations. Add your leg to chains that matter to you.',
  },
}

export default function ForYouRelaysPage() {
  return <ForYouRelaysClient />
}
