import type { Metadata } from 'next'
import { FeedContainer } from '@/components/feed/FeedContainer'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TrendingTicker } from '@/components/feed/TrendingTicker'
import { FeedAtmosphere } from '@/components/simulation/FeedAtmosphere'
import { LobbyRail } from '@/components/feed/LobbyRail'

export const metadata: Metadata = {
  title: 'Lobby Market — The People\'s Consensus Engine',
  description:
    'Vote on policy topics, debate in real-time, and turn consensus into law. ' +
    'A prediction market for democracy — where every voice shapes the outcome.',
  openGraph: {
    title: 'Lobby Market — The People\'s Consensus Engine',
    description:
      'Vote on policy topics, debate in real-time, and turn consensus into law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lobby Market — The People\'s Consensus Engine',
    description:
      'Vote on policy topics, debate in real-time, and turn consensus into law.',
  },
}

export default function Home() {
  return (
    <div className="relative flex flex-col h-screen">
      <FeedAtmosphere />
      <TopBar />
      <TrendingTicker />
      <main className="flex-1 overflow-hidden">
        <FeedContainer />
      </main>
      <BottomNav />
      {/* Desktop live rail — fixed right panel, only visible on 2xl+ screens */}
      <LobbyRail />
    </div>
  )
}
