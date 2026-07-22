import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-6 w-6 rounded-full" />
              ))}
              <Skeleton className="h-5 w-20 ml-1" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
