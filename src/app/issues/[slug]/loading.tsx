import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function IssueDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-6 pb-24 space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-surface-300" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded bg-surface-300" />
              <div className="h-4 w-72 rounded bg-surface-300" />
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-300" />
            ))}
          </div>
        </div>
        {/* Topics skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-surface-300 bg-surface-100 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
