import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function RandomLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-12 pb-28 md:pb-12 flex flex-col items-center">
        {/* Icon + title */}
        <Skeleton className="h-16 w-16 rounded-full mb-4" />
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />

        {/* Type selector buttons */}
        <div className="w-full space-y-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300/60">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        {/* CTA button */}
        <Skeleton className="h-12 w-48 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
