import { Users } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function ExpertCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 pt-0.5 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-16 rounded-sm" />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1 flex-wrap">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-300/50">
        {[0, 1, 2].map((i) => (
          <div key={i} className="text-center space-y-1">
            <Skeleton className="h-4 w-6 mx-auto" />
            <Skeleton className="h-2.5 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AMAExpertsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple flex-shrink-0" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-8 w-12 rounded-lg" />
          {[80, 90, 85, 72, 95, 78, 88, 76].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Sort row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <div className="flex gap-1">
            {[70, 80, 75].map((w, i) => (
              <Skeleton key={i} className="h-7 rounded-lg" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Expert cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <ExpertCardSkeleton key={i} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
