import type { Metadata } from 'next'
import { InfluenceClient } from './InfluenceClient'

export const metadata: Metadata = {
  title: 'Civic Influence · Lobby Market',
  description:
    'Visualise your civic vote network — see which topics you helped shape, laws you contributed to, and how your votes map across every category.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Influence · Lobby Market',
    description: "Your personal civic influence — an interactive graph of every topic you've voted on.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Influence · Lobby Market',
    description: 'Map your civic vote network and discover the laws you helped pass.',
  },
}

export default function InfluencePage() {
  return <InfluenceClient />
}
