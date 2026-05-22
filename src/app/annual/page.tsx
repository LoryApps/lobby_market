import type { Metadata } from 'next'
import { AnnualClient } from './AnnualClient'

export const metadata: Metadata = {
  title: 'Civic Annual · Lobby Market',
  description:
    'The Lobby Market all-time record — every topic debated, every law established, every citizen who shaped the civic landscape. Platform milestones, records, and contributors.',
  openGraph: {
    title: 'Civic Annual · Lobby Market',
    description:
      'All-time platform stats: total votes cast, laws established, debates held, and the records that define Lobby Market\'s civic legacy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Annual · Lobby Market',
    description: 'All-time civic records — laws, votes, debates, and the citizens who built the Lobby.',
  },
}

export default function AnnualPage() {
  return <AnnualClient />
}
