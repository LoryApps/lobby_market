import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AlignLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header — user comparison */}
        <div className="flex items-center gap-4 mb-8">
          <div className="text-center">
            <Skeleton className="h-14 w-14 rounded-full mx-auto mb-2" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
          <div className="flex-1 text-center">
            <Skeleton className="h-12 w-24 mx-auto mb-1" />
            <Skeleton className="h-3 w-28 mx-auto" />
          </div>
          <div className="text-center">
            <Skeleton className="h-14 w-14 rounded-full mx-auto mb-2" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        </div>

        {/* Agreement chart */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <Skeleton className="h-4 w-40 mb-3" />
          <Skeleton className="h-4 w-full rounded-full mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Shared votes */}
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <div className="flex gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
