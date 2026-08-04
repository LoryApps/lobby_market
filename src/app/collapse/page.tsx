import type { Metadata } from 'next'
import { CollapseClient } from './CollapseClient'

export const metadata: Metadata = {
  title: 'Consensus Collapse · Lobby Market',
  description:
    'Debates where public opinion has turned most dramatically in the last 7 days — previously winning positions now in freefall. Where the Lobby changed its mind.',
  openGraph: {
    title: 'Consensus Collapse · Lobby Market',
    description:
      'The biggest opinion reversals on the platform — debates that were winning and are now losing ground fast.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Consensus Collapse · Lobby Market',
    description: 'Where the Lobby changed its mind — biggest FOR% drops in the last 7 days.',
  },
}

export default function CollapsePage() {
  return <CollapseClient />
}
