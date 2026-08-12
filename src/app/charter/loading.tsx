import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CharterLoading() {
  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24">
        {/* Hero skeleton */}
        <section className="border-b border-surface-300 px-4 py-12">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Skeleton className="h-14 w-14 rounded-full mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-16 w-full max-w-xl mx-auto" />
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>

          {/* Articles */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>

          {/* CTA */}
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </>
  )
}
