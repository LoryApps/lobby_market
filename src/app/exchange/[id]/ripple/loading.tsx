import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RippleLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Ripple overview */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex justify-center">
            <Skeleton className="h-36 w-36 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-5 w-10 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Ripple markets */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 flex-1 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
