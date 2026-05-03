import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ChangelogLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-pulse">
          <div className="h-11 w-11 rounded-xl bg-surface-300" />
          <div>
            <div className="h-6 w-32 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-56 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Version sections */}
        {[1, 2, 3].map((v) => (
          <div key={v} className="mb-8 animate-pulse">
            {/* Version badge */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-6 w-20 bg-for-500/30 rounded-full" />
              <div className="h-4 w-24 bg-surface-300 rounded" />
            </div>
            {/* Feature list */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="h-8 w-8 rounded-lg bg-surface-300 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 w-36 bg-surface-300 rounded mb-1.5" />
                    <div className="h-3 bg-surface-300 rounded w-5/6" />
                  </div>
                  <div className="h-5 w-16 bg-surface-300 rounded-full flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
