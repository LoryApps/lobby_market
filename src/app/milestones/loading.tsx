import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MilestonesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-surface-300/40 animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-surface-300/30 animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-100 border border-surface-300 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3 mt-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-100 border border-surface-300 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
