import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PrepLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Market snapshot */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
            <Skeleton className="h-10 w-16 rounded-xl ml-3" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>

        {/* Research sections */}
        {['Momentum Analysis', 'Argument Quality', 'Risk Factors', 'Comparable Outcomes'].map((label, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}

        {/* Key questions */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0 mt-0.5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
