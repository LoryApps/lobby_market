import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionMembersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl bg-surface-200 animate-pulse flex-shrink-0" />
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-surface-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-5 w-32 rounded bg-surface-200 animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-surface-200 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-surface-100 border border-surface-300/40 animate-pulse"
            >
              <div className="h-4 w-4 rounded bg-surface-200" />
              <div className="h-5 w-10 rounded bg-surface-200" />
              <div className="h-2.5 w-14 rounded bg-surface-200" />
            </div>
          ))}
        </div>

        {/* Member rows */}
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100 border border-surface-300/40 animate-pulse"
            >
              <div className="h-10 w-10 rounded-full bg-surface-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-surface-200" />
                <div className="h-2.5 w-24 rounded bg-surface-200" />
              </div>
              <div className="hidden sm:flex gap-4">
                <div className="h-8 w-12 rounded bg-surface-200" />
                <div className="h-8 w-12 rounded bg-surface-200" />
              </div>
              <div className="h-6 w-16 rounded-lg bg-surface-200" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
