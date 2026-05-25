import type { Metadata } from 'next'
import { SynthesisClient } from './SynthesisClient'

export const metadata: Metadata = {
  title: 'Civic Synthesis Hub · Lobby Market',
  description:
    'Browse AI-generated syntheses of every major civic debate — common ground both sides share, core tensions driving disagreement, and nuanced positions that transcend the divide.',
  openGraph: {
    title: 'Civic Synthesis Hub · Lobby Market',
    description:
      'Where opposite sides find common ground. Explore AI-synthesized positions across every civic debate on the platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Synthesis Hub · Lobby Market',
    description:
      'AI-generated common ground, core tensions, and synthesis positions for every major civic debate.',
  },
}

export default function SynthesisPage() {
  return <SynthesisClient />
}
