import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MeridianLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-3 w-16 mb-3" />
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-7 w-56 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mt-1" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-2.5 w-16 mb-2" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-2xl mb-6" />
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
              <Skeleton className="h-1.5 w-full rounded-full mb-3" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
