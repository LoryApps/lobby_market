import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SwipeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 md:pb-12">
        {/* Progress bar */}
        <div className="w-full max-w-sm mb-6">
          <div className="h-1.5 bg-surface-300 rounded-full animate-pulse" />
        </div>

        {/* Card skeleton */}
        <div className="w-full max-w-sm rounded-2xl bg-surface-100 border border-surface-300 p-6 animate-pulse">
          {/* Category badge */}
          <div className="h-5 w-20 bg-surface-300 rounded-full mb-4" />
          {/* Statement */}
          <div className="space-y-2 mb-6">
            <div className="h-5 bg-surface-300 rounded w-full" />
            <div className="h-5 bg-surface-300 rounded w-5/6" />
            <div className="h-5 bg-surface-300 rounded w-3/4" />
          </div>
          {/* Vote bar */}
          <div className="h-2 bg-surface-300 rounded-full mb-4" />
          {/* Stats row */}
          <div className="flex gap-3">
            <div className="h-4 w-16 bg-surface-300 rounded" />
            <div className="h-4 w-16 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Vote buttons */}
        <div className="flex gap-4 mt-8">
          <div className="h-14 w-14 rounded-full bg-against-500/20 animate-pulse" />
          <div className="h-14 w-14 rounded-full bg-surface-300 animate-pulse" />
          <div className="h-14 w-14 rounded-full bg-for-500/20 animate-pulse" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
