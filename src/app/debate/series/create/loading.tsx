import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CreateSeriesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-68" />
        </div>
        {/* Steps indicator */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
