import type { Metadata } from 'next'
import { RippleClient } from './RippleClient'

export const metadata: Metadata = {
  title: 'Civic Ripple Effect · Lobby Market',
  description:
    'How resolved topics send momentum across the civic landscape. When a law passes or a motion fails, it ripples through connected debates — watch which active discussions are riding the wave and which are swimming upstream.',
  openGraph: {
    title: 'Civic Ripple Effect · Lobby Market',
    description:
      'Map the downstream influence of every civic verdict. Resolved topics create ripples — see which active debates are aligned with recent outcomes and which are moving against the tide.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Ripple Effect · Lobby Market',
    description:
      'When a law passes, it ripples. Track how recent verdicts align with — or oppose — active civic debates in the same category.',
  },
}

export default function RipplePage() {
  return <RippleClient />
}
