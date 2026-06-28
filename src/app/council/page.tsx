import type { Metadata } from 'next'
import { CouncilClient } from './CouncilClient'

export const metadata: Metadata = {
  title: 'The Grand Council · Lobby Market',
  description:
    'The Civic Grand Council — the top 20 citizens by reputation, empowered to propose motions that shape the Lobby\'s direction. Elevate topics, issue statements, and convene assemblies.',
  openGraph: {
    title: 'The Grand Council · Lobby Market',
    description:
      'The platform\'s meritocratic governance body. Top 20 citizens by clout, proposing and voting on resolutions that carry special civic weight.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Grand Council · Lobby Market',
    description: 'The top 20 citizens govern. Proposals. Motions. Civic resolutions. Real power.',
  },
}

export default function CouncilPage() {
  return <CouncilClient />
}
