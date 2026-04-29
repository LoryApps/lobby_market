import type { Metadata } from 'next'
import { SwipeClient } from './SwipeClient'

export const metadata: Metadata = {
  title: 'Swipe & Vote · Lobby Market',
  description:
    'Vote on civic topics one by one — swipe right to agree, left to disagree. A calm, deliberate way to make your voice heard.',
  openGraph: {
    title: 'Swipe & Vote · Lobby Market',
    description: 'A focused, card-by-card voting experience. No timer. Just your honest take.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Swipe & Vote · Lobby Market',
    description: 'Vote your conscience — one topic at a time.',
  },
}

export default function SwipePage() {
  return <SwipeClient />
}
