import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CatalystsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
            <div className="flex gap-2 pl-12">
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
            <div className="flex gap-2 pl-12">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
