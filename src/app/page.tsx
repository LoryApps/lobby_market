import { FeedContainer } from '@/components/feed/FeedContainer'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <FeedContainer />
      </main>
      <BottomNav />
    </div>
  )
}
