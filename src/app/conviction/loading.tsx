import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ConvictionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Score card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          <div className="flex gap-6 pt-3 border-t border-surface-300">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-16" />)}
          </div>
        </div>

        {/* Spotlight */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>

        {/* Categories */}
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
