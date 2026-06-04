import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CanvassLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* Back */}
        <Skeleton className="h-5 w-12 mb-5" />

        {/* Hero */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center space-y-1.5">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-14 mx-auto" />
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[70, 90, 80, 75, 85, 70].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-xl" style={{ width: w }} />
          ))}
        </div>

        {/* Topics */}
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
              <div className="flex items-start gap-3">
                <Skeleton className="h-3 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-4 w-4 flex-shrink-0" />
              </div>
              <div className="ml-9 space-y-1.5">
                <Skeleton className="h-1 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
              <div className="ml-9 flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
