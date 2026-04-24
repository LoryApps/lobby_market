import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HeatmapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>

        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          {/* Column headers */}
          <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}>
            <div />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 10 }).map((_, r) => (
            <div key={r} className="grid gap-1.5 mb-1.5 items-center" style={{ gridTemplateColumns: '140px repeat(5, 1fr)' }}>
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 5 }).map((_, c) => (
                <Skeleton key={c} className="h-14 rounded-lg" />
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 mt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
