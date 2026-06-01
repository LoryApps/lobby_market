import type { Metadata } from 'next'
import { EntropyClient } from './EntropyClient'

export const metadata: Metadata = {
  title: 'Civic Entropy Index · Lobby Market',
  description:
    'Which debates are in maximum democratic chaos? The Civic Entropy Index applies Shannon information theory to vote splits — the closer to 50/50 and the higher the turnout, the higher the entropy. These are the debates where the community is most genuinely divided.',
  openGraph: {
    title: 'Civic Entropy Index · Lobby Market',
    description:
      'Maximum disorder, maximum democracy. The debates where the Lobby is most evenly — and most fiercely — split.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Entropy Index · Lobby Market',
    description:
      'Shannon entropy applied to civic debate: the debates closest to 50/50 × the highest voter turnout. Pure democratic uncertainty.',
  },
}

export default function EntropyPage() {
  return <EntropyClient />
}
