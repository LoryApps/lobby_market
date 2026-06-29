import type { Metadata } from 'next'
import { OathClient } from './OathClient'

export const metadata: Metadata = {
  title: 'The Civic Oath · Lobby Market',
  description:
    'Take the Civic Oath — a formal pledge of good-faith participation in the Lobby. Choose your core value and join the Oath Roll.',
  robots: { index: false },
  openGraph: {
    title: 'The Civic Oath · Lobby Market',
    description:
      'A moment of civic commitment. Choose your guiding value and take the oath of good-faith participation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Oath · Lobby Market',
    description: 'Choose your civic value. Speak the oath. Join the Roll.',
  },
}

export default function OathPage() {
  return <OathClient />
}
