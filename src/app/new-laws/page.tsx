import type { Metadata } from 'next'
import { NewLawsClient } from './NewLawsClient'

export const metadata: Metadata = {
  title: 'New Laws · Lobby Market',
  description:
    'The most recently established civic laws — debates the Lobby democratically resolved into consensus. Track the democratic process as proposals become law.',
  openGraph: {
    title: 'New Laws · Lobby Market',
    description:
      'Every debate that just crossed the threshold of consensus and became law. The democratic victory lap.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'New Laws · Lobby Market',
    description: 'The latest civic laws established by community consensus on Lobby Market.',
  },
}

export default function NewLawsPage() {
  return <NewLawsClient />
}
