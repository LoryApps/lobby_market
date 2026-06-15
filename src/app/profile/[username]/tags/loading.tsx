import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileTagsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <Skeleton className="h-5 w-28 mb-5" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-3 flex flex-col items-center gap-1">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
