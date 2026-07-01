import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BreakdownLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100 text-white">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-5">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
