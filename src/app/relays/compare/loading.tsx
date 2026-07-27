import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayCompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-44 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />

        {/* Relay selectors */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-3 border-b border-surface-300 last:border-0">
              <Skeleton className="flex-1 h-4" />
              <Skeleton className="h-4 w-16 flex-shrink-0" />
              <Skeleton className="flex-1 h-4" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
