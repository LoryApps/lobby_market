import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WrapLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
