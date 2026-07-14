import type { Metadata } from 'next'
import { CommitteesClient } from './CommitteesClient'

export const metadata: Metadata = {
  title: 'Select Committees · Lobby Market',
  description:
    'The standing Select Committees of the Lobby — permanent bodies that scrutinise policy across Economics, Politics, Technology, and seven more domains. Follow committees, read inquiry findings, and submit evidence.',
  openGraph: {
    title: 'Civic Select Committees · Lobby Market',
    description:
      'Ten standing committees, each holding government to account in their policy domain. Follow an inquiry, submit evidence, and shape the findings.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Select Committees · Lobby Market',
    description: 'Standing committees scrutinising civic policy — follow, submit evidence, and shape findings.',
  },
}

export default function CommitteesPage() {
  return <CommitteesClient />
}
