import type { Metadata } from 'next'
import { QuarterlyClient } from './QuarterlyClient'

export const metadata: Metadata = {
  title: 'Civic Quarterly · Lobby Market',
  description:
    'The Lobby Market quarterly civic report — laws established, hottest debates, top arguments, and the citizens who shaped the conversation over the past three months.',
  openGraph: {
    title: 'Civic Quarterly · Lobby Market',
    description:
      'Three months of civic activity: votes cast, laws established, debates held, and the arguments that defined the quarter.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Quarterly · Lobby Market',
    description: 'The quarterly civic report — 90 days of laws, debates, and top arguments.',
  },
}

export default function QuarterlyPage() {
  return <QuarterlyClient />
}
