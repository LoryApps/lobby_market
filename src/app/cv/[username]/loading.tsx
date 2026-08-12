import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicCVLoading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="flex items-start gap-4">
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
