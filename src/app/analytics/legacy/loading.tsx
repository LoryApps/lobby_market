import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LegacyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-16 w-full mb-2" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full mb-3" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
