import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TippingPointLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-start gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-5" />
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
        <div className="space-y-10">
          {[0, 1].map((s) => (
            <div key={s} className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-xl" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
