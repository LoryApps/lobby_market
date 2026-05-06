import type { Metadata } from 'next'
import { MemoriesClient } from './MemoriesClient'

export const metadata: Metadata = {
  title: 'Civic Memories · Lobby Market',
  description:
    'On this day in civic history — relive your past votes and arguments, and see which laws were ratified and debates proposed on this date in prior years.',
  openGraph: {
    title: 'Civic Memories · Lobby Market',
    description:
      'Your "On This Day" civic diary. Revisit past votes, arguments, and platform milestones from this calendar date across the years.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Memories · Lobby Market',
    description: 'What were you debating on this date last year? Your civic memory lane.',
  },
}

export default function MemoriesPage() {
  return <MemoriesClient />
}
