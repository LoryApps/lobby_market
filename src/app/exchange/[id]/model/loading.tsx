import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ModelLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Fair value estimate */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4 text-center">
          <Skeleton className="h-4 w-36 mx-auto" />
          <Skeleton className="h-16 w-32 mx-auto rounded-2xl" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <div className="flex justify-center gap-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* Model inputs */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-surface-300/30">
              <Skeleton className="h-4 w-36" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Scenarios */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-50 border border-surface-300/60 p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
