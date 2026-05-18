import type { Metadata } from 'next'
import { AnthologyClient } from './AnthologyClient'

export const metadata: Metadata = {
  title: 'The Argument Anthology · Lobby Market',
  description:
    "The civic platform's best arguments, curated daily. Five outstanding voices from today's debates — ranked by community upvotes and argument quality.",
  openGraph: {
    title: 'The Argument Anthology · Lobby Market',
    description:
      'Five outstanding civic arguments, curated from the day\'s debates. Real voices making real cases — ranked by community and quality score.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Argument Anthology · Lobby Market',
    description: "The Lobby's best arguments, curated daily. Five voices. Two sides. One civic moment.",
  },
}

export default function AnthologyPage() {
  return <AnthologyClient />
}
