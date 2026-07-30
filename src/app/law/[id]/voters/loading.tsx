import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawVotersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <Skeleton className="h-4 w-24 mb-6" />
        <Skeleton className="h-5 w-3/4 mb-2" />
        <div className="mb-6 space-y-3 rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-xl" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
