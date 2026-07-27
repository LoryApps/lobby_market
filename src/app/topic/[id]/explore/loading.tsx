import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-surface-300/50 rounded-lg" />
          <div className="h-4 w-96 bg-surface-300/40 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-200/50 rounded-xl border border-surface-300/30" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
