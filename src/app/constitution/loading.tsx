import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ConstitutionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-lg bg-surface-200 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-5 w-48 rounded bg-surface-300 animate-pulse" />
            <div className="h-3 w-32 rounded bg-surface-300 animate-pulse" />
          </div>
        </div>

        {/* Document header skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 mb-4 text-center space-y-4 animate-pulse">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-surface-300" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-surface-300 mx-auto" />
            <div className="h-7 w-64 rounded bg-surface-300 mx-auto" />
            <div className="h-4 w-80 rounded bg-surface-300 mx-auto" />
          </div>
          <div className="flex justify-center gap-8 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-6 w-12 rounded bg-surface-300 mx-auto" />
                <div className="h-3 w-10 rounded bg-surface-300 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Article skeletons */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-3 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-surface-300 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 rounded bg-surface-300" />
                <div className="h-4 w-36 rounded bg-surface-300" />
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
