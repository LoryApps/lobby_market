import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ContrarianLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-52" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-44" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
