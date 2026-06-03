import type { Metadata } from 'next'
import { ZenithClient } from './ZenithClient'

export const metadata: Metadata = {
  title: 'The Civic Zenith · Lobby Market',
  description:
    'All-time peak moments in Lobby Market history — the most voted debate, the fastest law ever passed, the highest consensus ever reached, and the greatest days in civic history.',
  openGraph: {
    title: 'The Civic Zenith · Lobby Market',
    description:
      'Peak civic moments: the most voted debate, the strongest consensus ever reached, the day the most laws were born, and the record-breaking topics that defined the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Zenith · Lobby Market',
    description:
      'All-time platform peaks — records that may never be broken.',
  },
}

export default function ZenithPage() {
  return <ZenithClient />
}
