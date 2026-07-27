import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileMomentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Moment cards — mixed sizes */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <Skeleton className="h-4 w-full mb-1.5" />
              {i % 2 === 0 && <Skeleton className="h-4 w-4/5 mb-1.5" />}
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-3 mt-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
