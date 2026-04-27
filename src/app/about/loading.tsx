import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AboutLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-10 pb-24 md:pb-12">
        <div className="mb-10 space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-32" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>

        {/* Long text section */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
