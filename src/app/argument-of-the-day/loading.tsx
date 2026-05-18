import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 space-y-6">
        {/* Header skeleton */}
        <div className="text-center space-y-2 pt-4">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-8 w-56 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>

        {/* Hero card skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* Archive skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
