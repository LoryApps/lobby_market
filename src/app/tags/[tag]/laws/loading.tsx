import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TagLawsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        <Skeleton className="h-5 w-20 rounded mb-4" />
        <div className="space-y-1.5 mb-5">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-gold/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-4 w-6 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-full rounded ml-6" />
              <Skeleton className="h-4 w-4/5 rounded ml-6" />
              <Skeleton className="h-1 w-full rounded-full ml-6" />
              <div className="flex justify-between ml-6">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
