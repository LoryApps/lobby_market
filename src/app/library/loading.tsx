import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LibraryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-4 w-72 ml-12" />
          <div className="flex items-center gap-4 mt-3 ml-12">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>

        {/* Search bar */}
        <Skeleton className="h-11 w-full rounded-xl mb-4" />

        {/* Section tabs */}
        <Skeleton className="h-9 w-72 rounded-xl mb-4" />

        {/* Category pills */}
        <div className="flex items-center gap-1.5 mb-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 h-6 w-16 rounded-full" />
          ))}
        </div>

        {/* Wiki section */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-2 border-t border-surface-300/60">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arguments section */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-16 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
