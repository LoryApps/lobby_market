import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PositionsMapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6 flex items-start justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-surface-300" />
            <div className="space-y-2">
              <div className="h-6 w-36 bg-surface-300 rounded" />
              <div className="h-3.5 w-52 bg-surface-300 rounded" />
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-surface-300" />
        </div>

        {/* Stats bar skeleton */}
        <div className="grid grid-cols-4 gap-3 mb-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <div className="h-6 w-12 bg-surface-300 rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-surface-300 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Canvas skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 animate-pulse" style={{ height: 520 }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-surface-600 font-mono text-sm">Loading your civic map…</div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
