import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicRankLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 gap-6">
        <Skeleton className="h-20 w-20 rounded-3xl" />
        <Skeleton className="h-8 w-40" />
        <div className="w-full max-w-sm space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
