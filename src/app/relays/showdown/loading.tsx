import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayShowdownLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />

        {/* Head-to-head panels */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[0, 1].map((side) => (
            <div key={side} className={`rounded-xl bg-surface-100 border p-4 ${side === 0 ? 'border-for-500/30' : 'border-against-500/30'}`}>
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-2" />
              <Skeleton className="h-4 w-24 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Argument chain */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-xl bg-surface-100 border border-surface-300 p-4 ${i % 2 === 0 ? 'ml-0 mr-8' : 'ml-8 mr-0'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-12 rounded-full ml-auto" />
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
