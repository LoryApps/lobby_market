import type { Metadata } from 'next'
import { TimingClient } from './TimingClient'

export const metadata: Metadata = {
  title: 'Civic Timing · Lobby Market',
  description:
    'Discover your civic rhythm — when you vote, how early you engage with new debates, and whether you\'re a Trailblazer or an Archivist. Your voting timing profile, decoded.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Timing · Lobby Market',
    description:
      'Are you a dawn voter or a midnight deliberator? A trailblazer who jumps on new topics or a late majority who waits for consensus? Find your timing archetype.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Timing · Lobby Market',
    description: 'Your civic rhythm — when you vote, how early you engage, and your timing archetype.',
  },
}

export default function TimingPage() {
  return <TimingClient />
}
