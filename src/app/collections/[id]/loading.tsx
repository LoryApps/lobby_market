import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CollectionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {/* Collection header */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        {/* Topic items */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-1.5 flex-1 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
