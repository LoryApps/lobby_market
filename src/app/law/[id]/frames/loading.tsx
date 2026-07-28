import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawFramesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Law header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        {/* Intro */}
        <Skeleton className="h-16 w-full rounded-xl mb-5" />

        {/* Landscape */}
        <Skeleton className="h-28 w-full rounded-xl mb-4" />

        {/* Tab pills */}
        <div className="flex gap-1.5 mb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        {/* Frame cards grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/20 bg-surface-200/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full ml-auto" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex gap-1">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-5 w-16 rounded" />
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>

        {/* Spectrum */}
        <Skeleton className="h-56 w-full rounded-xl mt-5" />
      </main>
      <BottomNav />
    </div>
  )
}
