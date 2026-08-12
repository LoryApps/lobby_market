import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function QuestLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5 h-4 w-24 rounded bg-surface-300 animate-pulse" />
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-surface-300 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-6 w-44 rounded bg-surface-300 animate-pulse" />
            <div className="h-3.5 w-32 rounded bg-surface-300 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1.5 mb-6">
          {[120, 100, 100, 110].map((w, i) => (
            <div key={i} className="h-9 rounded-xl bg-surface-300 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-300 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
