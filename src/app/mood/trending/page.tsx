import type { Metadata } from 'next'
import { TrendingMoodClient } from './TrendingMoodClient'

export const metadata: Metadata = {
  title: 'Mood Trends · Lobby Market',
  description:
    'See which civic emotions are rising and falling across the platform. Track mood velocity — hopeful, worried, inspired, frustrated — over the last 24h, 7 days, or 30 days.',
  openGraph: {
    title: 'Mood Trends · Lobby Market',
    description:
      "Which emotions are surging in civic debate right now? Real-time mood velocity across the Lobby — see what's rising and what's fading.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Mood Trends · Lobby Market',
    description:
      "Track civic emotion in real time. Which moods are rising? Which are falling? The platform's emotional velocity, updated live.",
  },
}

export default function TrendingMoodPage() {
  return <TrendingMoodClient />
}
