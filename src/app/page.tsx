import { FeedContainer } from '@/components/feed/FeedContainer'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { FeedAtmosphere } from '@/components/simulation/FeedAtmosphere'

export default function Home() {
  return (
    <div className="relative flex flex-col h-screen">
      <FeedAtmosphere />
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <FeedContainer />
      </main>
      <BottomNav />
    </div>
  )
}
