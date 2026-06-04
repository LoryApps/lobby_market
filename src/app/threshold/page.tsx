import type { Metadata } from 'next'
import { ThresholdClient } from './ThresholdClient'

export const metadata: Metadata = {
  title: 'The Civic Threshold · Lobby Market',
  description:
    'Track topics at critical transition moments — on the brink of activation, entering the voting phase, and nearing law or failure. The platform\'s inflection events in real time.',
  openGraph: {
    title: 'The Civic Threshold · Lobby Market',
    description:
      'Five threshold zones: topics activating, just opened for debate, entering the final vote, heading toward consensus law, or approaching rejection. Where civic democracy crosses its tipping points.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Threshold · Lobby Market',
    description:
      'Topics at critical transition moments — activating, entering vote, nearing law or failure.',
  },
}

export default function ThresholdPage() {
  return <ThresholdClient />
}
