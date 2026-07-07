import type { Metadata } from 'next'
import { AskClient } from './AskClient'

export const metadata: Metadata = {
  title: 'Civic Counsel · Lobby Market',
  description:
    'Ask the Civic Counsel — an AI assistant with real-time knowledge of every debate, law, and argument in the Lobby.',
  openGraph: {
    title: 'Civic Counsel · Lobby Market',
    description: 'Get instant insight on any civic debate, law, or policy topic.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function AskPage() {
  return <AskClient />
}
