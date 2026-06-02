import type { Metadata } from 'next'
import { TurbulenceClient } from './TurbulenceClient'

export const metadata: Metadata = {
  title: 'Civic Turbulence · Lobby Market',
  description:
    'Topics in the eye of the storm — high engagement, near-50/50 split, and actively contested right now. These are the debates that refuse to resolve.',
  openGraph: {
    title: 'Civic Turbulence · Lobby Market',
    description:
      'The most chaotically contested debates on the platform. High votes, near-deadlock, surging activity — turbulence in civic form.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Turbulence · Lobby Market',
    description: 'Which debates are in the eye of the storm? High engagement, near 50/50, no consensus in sight.',
  },
}

export default function TurbulencePage() {
  return <TurbulenceClient />
}
