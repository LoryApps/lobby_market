import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayNetworkLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-44 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />

        {/* Network graph placeholder */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6 flex items-center justify-center" style={{ height: 280 }}>
          <Skeleton className="h-full w-full rounded-xl" />
        </div>

        {/* Top relayers */}
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
