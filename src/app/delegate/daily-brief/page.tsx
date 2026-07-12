import type { Metadata } from 'next'
import { DailyBriefClient } from './DailyBriefClient'

export const metadata: Metadata = {
  title: 'Daily Delegation Brief · Lobby Market',
  description:
    "See what your delegates voted on today at a glance — confirm, override, or mirror their choices before the day ends.",
  robots: { index: false },
  openGraph: {
    title: 'Daily Delegation Brief · Lobby Market',
    description: "Today's delegation digest — who voted what, where you agree, and what still needs your attention.",
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function DailyBriefPage() {
  return <DailyBriefClient />
}
