import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LoadingLawDiscuss() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28 md:pb-8 flex flex-col gap-4">
        {/* Back nav skeleton */}
        <div className="h-5 w-24 bg-surface-300/50 rounded animate-pulse" />

        {/* Law header card skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-300/50 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 bg-surface-300/50 rounded animate-pulse" />
              <div className="h-5 w-full bg-surface-300/40 rounded animate-pulse" />
              <div className="h-5 w-2/3 bg-surface-300/30 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-4 mt-4 pt-4 border-t border-surface-300/50">
            <div className="h-3 w-20 bg-surface-300/40 rounded animate-pulse" />
            <div className="h-3 w-24 bg-surface-300/30 rounded animate-pulse" />
          </div>
        </div>

        {/* Chat skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/50 p-5 space-y-4 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="h-7 w-7 rounded-full bg-surface-300/50 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-20 bg-surface-300/50 rounded animate-pulse" />
                <div className="h-3 w-full bg-surface-300/40 rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-surface-300/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
