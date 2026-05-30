import type { Metadata } from 'next'
import { ZeitgeistClient } from './ZeitgeistClient'

export const metadata: Metadata = {
  title: 'Civic Zeitgeist · Lobby Market',
  description:
    'The spirit of civic discourse right now — platform mood, category temperatures, consensus strength, and the week\'s most contested debates.',
  openGraph: {
    title: 'Civic Zeitgeist · Lobby Market',
    description:
      'The spirit of the time. Where is civic consensus forming, where is it breaking? Platform-wide mood and momentum.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Zeitgeist · Lobby Market',
    description: 'The mood of the Lobby — right now.',
  },
}

export default function ZeitgeistPage() {
  return <ZeitgeistClient />
}
