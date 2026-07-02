import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CrossExamineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <Skeleton className="h-3 w-24 mb-6" />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
                  <div className="px-4 py-3 bg-surface-200/40 flex items-center gap-2">
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-3 w-8 ml-auto" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
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
