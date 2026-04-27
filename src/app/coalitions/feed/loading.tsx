import { Users } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsFeedLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Users className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>

        {/* Post cards */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              {/* Author + coalition */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>

              {/* Post content */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                {i % 2 === 0 && <Skeleton className="h-4 w-3/4" />}
              </div>

              {/* Linked topic */}
              {i % 3 === 0 && (
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                  <div className="flex gap-2 mt-1">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-12 rounded-full" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 pt-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
