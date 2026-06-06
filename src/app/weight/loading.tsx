import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WeightLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
