import type { Metadata } from 'next'
import { DailyClient } from './DailyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Daily Briefing · Lobby Market',
  description:
    'Your personalized daily civic action center — votes remaining, upcoming debates, hot topics, recent laws, and your active engagements.',
  openGraph: {
    title: 'Daily Briefing · Lobby Market',
    description:
      'What to do in the Lobby today. Hot topics, upcoming debates, recent laws, and your personal civic mission.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Daily Briefing · Lobby Market',
    description: 'Your daily civic action center — what\'s happening and what to do in the Lobby today.',
  },
}

export default function DailyPage() {
  return <DailyClient />
}
