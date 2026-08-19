import type { Metadata } from 'next'
import { CensusClient } from './CensusClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Argument Writer Census · Lobby Market',
  description:
    'Who writes arguments on Lobby Market? Breakdown by civic role, membership seniority, clout standing, and voting activity — with FOR/AGAINST lean and average upvotes per segment.',
  openGraph: {
    title: 'Argument Writer Census · Lobby Market',
    description:
      'Demographic breakdown of argument authors: role, seniority, clout, and activity.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Writer Census · Lobby Market',
    description: 'Who writes the arguments? Demographic breakdown by role, seniority, clout, and activity.',
  },
  robots: { index: false },
}

export default function ArgumentCensusPage() {
  return <CensusClient />
}
