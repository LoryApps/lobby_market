import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawBlueprintLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-5 w-24 mb-6" />
        <div className="mb-6 space-y-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex gap-5">
              <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-4 w-1/4" />
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
