import type { Metadata } from 'next'
import { FrontierClient } from './FrontierClient'

export const metadata: Metadata = {
  title: 'The Civic Frontier · Lobby Market',
  description:
    'The leading edge of civic debate — newest proposals, early-stage topics where discussion is just beginning, and categories with the fewest established laws.',
  openGraph: {
    title: 'The Civic Frontier · Lobby Market',
    description:
      'Where civic debate is just beginning. Explore the freshest proposed topics, early-stage debates, and uncovered civic ground.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Frontier · Lobby Market',
    description:
      'The freshest civic debates — just proposed, barely voted on, and wide open for your input.',
  },
}

export default function FrontierPage() {
  return <FrontierClient />
}
