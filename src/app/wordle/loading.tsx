import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function WordleLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-sm mx-auto w-full px-4 py-6 pb-24 flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>

        {/* 6x5 letter grid */}
        <div className="space-y-2 mb-6">
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="flex gap-2">
              {Array.from({ length: 5 }).map((_, col) => (
                <Skeleton key={col} className="h-12 w-12 rounded-lg" />
              ))}
            </div>
          ))}
        </div>

        {/* Keyboard rows */}
        <div className="space-y-2 w-full">
          {[10, 9, 7].map((cols, row) => (
            <div key={row} className="flex gap-1.5 justify-center">
              {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} className={`h-10 rounded-lg ${i === 0 && row === 2 ? 'w-14' : i === cols - 1 && row === 2 ? 'w-14' : 'w-9'}`} />
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
