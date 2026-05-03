import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function AmendmentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-11 w-11 rounded-xl bg-gold/20" />
          <div>
            <div className="h-6 w-48 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-64 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Category filter scroll */}
        <div className="flex gap-2 mb-5 overflow-hidden animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-7 w-20 bg-surface-200 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Amendment cards */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 animate-pulse">
              {/* Parent law link */}
              <div className="h-4 w-48 bg-gold/20 rounded mb-3" />
              {/* Amendment text */}
              <div className="space-y-2 mb-4">
                <div className="h-5 bg-surface-300 rounded w-full" />
                <div className="h-5 bg-surface-300 rounded w-4/5" />
              </div>
              {/* Vote bar */}
              <div className="h-2 bg-surface-200 rounded-full mb-3">
                <div className="h-full bg-for-500/40 rounded-full" style={{ width: `${30 + i * 15}%` }} />
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="h-7 w-16 bg-for-500/20 rounded-lg" />
                  <div className="h-7 w-16 bg-against-500/20 rounded-lg" />
                </div>
                <div className="h-4 w-20 bg-surface-300 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
