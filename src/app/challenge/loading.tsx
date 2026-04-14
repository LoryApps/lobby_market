import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ChallengeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-xl bg-surface-300 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-7 w-40 bg-surface-300 rounded animate-pulse" />
              <div className="h-3 w-32 bg-surface-300 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 flex items-center gap-5">
            <div className="h-28 w-28 rounded-full bg-surface-300 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-surface-300 rounded animate-pulse" />
              <div className="h-3 w-48 bg-surface-300 rounded animate-pulse" />
              <div className="flex gap-2 mt-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 w-7 rounded-full bg-surface-300 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-surface-300 rounded-full animate-pulse" />
                <div className="h-5 w-20 bg-surface-300 rounded-full animate-pulse" />
              </div>
              <div className="h-6 w-4/5 bg-surface-300 rounded animate-pulse" />
              <div className="h-2 w-full bg-surface-300 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
