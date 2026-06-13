import type { Metadata } from 'next'
import { LawConflictsClient } from './LawConflictsClient'

export const metadata: Metadata = {
  title: 'Law Conflicts · Lobby Market',
  description:
    'Detect potential contradictions and overlaps between established laws in the Civic Codex — surfacing direct oppositions, substantive overlaps, and scope tensions for community review.',
  openGraph: {
    title: 'Law Conflicts · Lobby Market',
    description:
      'Which laws in the Codex might contradict each other? Automated conflict detection reveals oppositions, overlaps, and scope tensions for citizen review.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Law Conflicts · Lobby Market',
    description:
      'Detect potential contradictions and overlaps in the Civic Codex — direct oppositions, substantive overlaps, and scope tensions.',
  },
}

export default function LawConflictsPage() {
  return <LawConflictsClient />
}
