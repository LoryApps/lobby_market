import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ContestedArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-4 w-24 mb-5" />
        <div className="mb-6 flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-36 mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-8 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-36 mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
