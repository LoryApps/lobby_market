import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CorrelationsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-3 w-24 rounded mb-4" />
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-52 rounded" />
          </div>
          <Skeleton className="h-3 w-80 rounded mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-8 w-full rounded-lg mb-4" />
        <div className="flex gap-1.5 mb-5">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
