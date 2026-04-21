import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PetitionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-52 rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl mb-6" />
        <Skeleton className="h-20 w-full rounded-xl mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300/50 bg-surface-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-12 w-full rounded" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-40 rounded" />
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
