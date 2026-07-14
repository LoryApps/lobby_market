import type { Metadata } from 'next'
import { MinisterialStatementsClient } from './MinisterialStatementsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Ministerial Statements · Lobby Market',
  description:
    'Formal statements from civic ministers on policy, law, and governance — followed by supplementary questions from citizens. The despatch box of the Lobby.',
  openGraph: {
    title: 'Ministerial Statements · Lobby Market',
    description:
      'Ministers make formal statements on any civic matter. Citizens respond with supplementary questions. Westminster-style government accountability in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Ministerial Statements · Lobby Market',
    description: 'Formal ministerial statements on civic matters — with citizen supplementary questions.',
  },
}

export default function MinisterialStatementsPage() {
  return <MinisterialStatementsClient />
}
