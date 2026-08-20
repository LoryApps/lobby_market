import type { Metadata } from 'next'
import { MoodVsVotesClient } from './MoodVsVotesClient'

export const metadata: Metadata = {
  title: 'Mood vs. Votes · Lobby Market',
  description:
    'Do your feelings predict your votes? See how each civic mood — hopeful, inspired, frustrated, angry — correlates with FOR or AGAINST votes across the platform.',
  openGraph: {
    title: 'Mood vs. Votes · Lobby Market',
    description:
      'The emotional logic of civic democracy — how each mood (hopeful, worried, angry, inspired) maps to For and Against votes across all platform topics.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Mood vs. Votes · Lobby Market',
    description: 'Does feeling hopeful make you vote FOR more? Does anger drive AGAINST votes? Find out.',
  },
}

export default function MoodVsVotesPage() {
  return <MoodVsVotesClient />
}
