import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RapidLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
        </div>

        {/* Card stack */}
        <div className="relative">
          {/* Background cards for stack effect */}
          <div className="absolute inset-x-2 top-2 h-full rounded-2xl bg-surface-100/60 border border-surface-300/60" />
          <div className="absolute inset-x-4 top-4 h-full rounded-2xl bg-surface-100/30 border border-surface-300/30" />

          {/* Main card */}
          <div className="relative rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5 animate-pulse">
            {/* Category + status badges */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Topic statement */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-6 w-4/5" />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 py-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Current consensus bar */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            {/* Vote buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>

            {/* Skip link */}
            <div className="flex justify-center pt-1">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
