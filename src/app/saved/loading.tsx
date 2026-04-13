import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { SkeletonCard } from '@/components/ui/Skeleton'

export default function SavedTopicsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-surface-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-40 rounded bg-surface-300 animate-pulse" />
            <div className="h-4 w-24 rounded bg-surface-200 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
