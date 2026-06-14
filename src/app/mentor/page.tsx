import type { Metadata } from 'next'
import { MentorClient } from './MentorClient'

export const metadata: Metadata = {
  title: 'Civic Mentor Exchange · Lobby Market',
  description:
    'Connect with experienced citizens who can guide your civic journey. Browse debators, troll-catchers, and elders ranked by reputation — then send them a message.',
  openGraph: {
    title: 'Civic Mentor Exchange · Lobby Market',
    description:
      'Find a civic mentor — an experienced Lobby citizen who can help you argue better, vote smarter, and climb the ranks. Browse by category expertise or reputation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Mentor Exchange · Lobby Market',
    description: 'Find an experienced citizen to guide your civic journey. Browse by expertise and reputation.',
  },
}

export default function MentorPage() {
  return <MentorClient />
}
