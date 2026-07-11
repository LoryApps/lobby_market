import type { Metadata } from 'next'
import { DelegateInboxClient } from './DelegateInboxClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Delegate Inbox · Lobby Market',
  description:
    'Review and act on pending mirror votes from your trusted delegates. See what your delegates voted on and decide whether to mirror or override their stance.',
  openGraph: {
    title: 'Delegate Inbox · Lobby Market',
    description:
      'Topics your delegates have voted on — mirror their vote or take your own stance.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Delegate Inbox · Lobby Market',
    description:
      'Your liquid democracy inbox — review delegate votes and decide to mirror or override.',
  },
}

export default function DelegateInboxPage() {
  return <DelegateInboxClient />
}
