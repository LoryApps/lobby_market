import { Target } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function DriveSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      {/* Coalition header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Drive title */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />

      {/* Topic reference */}
      <div className="flex items-start gap-1.5">
        <Skeleton className="h-3 w-3 rounded-sm flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  )
}

export default function CoalitionDrivesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 flex-shrink-0">
              <Target className="h-5 w-5 text-surface-500" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 rounded-lg flex-shrink-0" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl ml-auto">
            <Skeleton className="h-7 w-12 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-14 rounded-lg" />
          </div>
        </div>

        {/* Drive cards */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <DriveSkeleton key={i} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
