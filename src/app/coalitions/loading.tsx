import { Users } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Users className="h-5 w-5 text-purple" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 rounded-xl flex-shrink-0" />
        </div>

        {/* Pending invites skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-3 py-2">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
          </div>
        </div>

        {/* Grid of coalition cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full flex-shrink-0" />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Action */}
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
