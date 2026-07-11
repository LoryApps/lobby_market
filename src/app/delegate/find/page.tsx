import type { Metadata } from 'next'
import { FindDelegateClient } from './FindDelegateClient'

export const metadata: Metadata = {
  title: 'Find a Delegate · Lobby Market',
  description:
    'Discover citizens who vote just like you. Your personalized delegate recommendations, ranked by vote alignment — find the right civic voice to trust with your votes.',
  openGraph: {
    title: 'Find a Delegate · Lobby Market',
    description:
      'Personalized delegate discovery powered by vote alignment. See who in the Lobby votes most like you, by category and overall.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Find a Delegate · Lobby Market',
    description: 'Who votes like you? Find your ideal delegate ranked by vote alignment.',
  },
}

export default function FindDelegatePage() {
  return <FindDelegateClient />
}
