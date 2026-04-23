import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        <div className="flex justify-center mb-8">
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
        <div className="rounded-3xl border border-surface-300 p-6 mb-6 space-y-4">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-8 w-12 ml-auto" />
        </div>
        <div className="rounded-2xl border border-surface-300 p-4 mb-6 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="rounded-2xl border border-surface-300 overflow-hidden mb-6">
          <div className="border-b border-surface-300 px-4 py-2.5">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full mt-4" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-3" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
