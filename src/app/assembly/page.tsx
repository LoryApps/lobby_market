import type { Metadata } from 'next'
import { AssemblyClient } from './AssemblyClient'

export const metadata: Metadata = {
  title: "Citizens' Assembly · Lobby Market",
  description:
    "Democracy's deliberative body. Randomly convened citizens study a contested topic, deliberate across multiple rounds, and deliver a collective recommendation that shapes platform consensus.",
  openGraph: {
    title: "Citizens' Assembly · Lobby Market",
    description:
      'Sortition-based civic deliberation. A randomly selected body of citizens studies the evidence, deliberates in structured rounds, and reaches a collective recommendation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "Citizens' Assembly · Lobby Market",
    description:
      'Randomly selected. Thoughtfully deliberated. Collectively decided. The Citizens\' Assembly brings sortition to civic debate.',
  },
}

export default function AssemblyPage() {
  return <AssemblyClient />
}
