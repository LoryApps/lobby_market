import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function IntroduceBillLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-8" />

        {/* Form */}
        <div className="space-y-6">
          {/* Bill title */}
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Category */}
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Bill type */}
          <div>
            <Skeleton className="h-3 w-16 mb-2" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>

          {/* Summary */}
          <div>
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>

          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
