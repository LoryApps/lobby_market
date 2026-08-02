import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawOriginsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-5/6" />
          <Skeleton className="h-7 w-3/4" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
