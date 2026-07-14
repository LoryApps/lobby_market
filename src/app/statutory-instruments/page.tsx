import type { Metadata } from 'next'
import { StatutoryInstrumentsClient } from './StatutoryInstrumentsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Statutory Instruments · Lobby Market',
  description:
    'Secondary legislation laid before the Civic Parliament — Orders, Regulations, and Rules made under powers delegated by primary legislation. Table prayers of annulment, vote on affirmative instruments.',
  openGraph: {
    title: 'Statutory Instruments · Lobby Market',
    description:
      'Secondary legislation from the civic government. Negative instruments take effect automatically unless parliament prays against them. Affirmative instruments require a formal vote.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Statutory Instruments · Lobby Market',
    description: 'Secondary legislation laid before parliament — pray against negative SIs or vote on affirmative ones.',
  },
}

export default function StatutoryInstrumentsPage() {
  return <StatutoryInstrumentsClient />
}
