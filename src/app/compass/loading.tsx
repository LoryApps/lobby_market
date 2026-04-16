import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CompassLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-[280px] w-[280px] rounded-full bg-surface-300/30 flex-shrink-0" />
            <div className="flex flex-col gap-3 w-full">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-surface-300 bg-surface-100 p-6 animate-pulse space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-20 h-3" />
              <Skeleton className="flex-1 h-4 rounded-full" />
              <Skeleton className="w-14 h-3" />
              <Skeleton className="w-8 h-3" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
