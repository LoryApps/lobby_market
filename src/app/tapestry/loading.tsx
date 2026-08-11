import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TapestryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 14 }).map((_, j) => (
                  <Skeleton key={j} className={`h-8 rounded-sm ${j % 4 === 0 ? 'w-32' : j % 3 === 0 ? 'w-20' : 'w-14'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
