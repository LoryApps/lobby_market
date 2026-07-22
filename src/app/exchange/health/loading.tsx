import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HealthLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Platform health gauge */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center space-y-3">
          <Skeleton className="h-4 w-36 mx-auto" />
          <Skeleton className="h-24 w-24 mx-auto rounded-full" />
          <Skeleton className="h-6 w-28 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Health dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
