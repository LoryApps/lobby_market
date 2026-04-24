import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function NewspaperLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Masthead skeleton */}
        <div className="text-center border-b-2 border-white pb-4 mb-1">
          <Skeleton className="h-3 w-32 mx-auto mb-2" />
          <Skeleton className="h-12 w-80 mx-auto mb-2" />
          <Skeleton className="h-3 w-48 mx-auto" />
        </div>

        <div className="flex items-center justify-between py-1.5 border-b border-surface-300 mb-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-48" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          {/* Lead story */}
          <div className="lg:col-span-2 lg:pr-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:pl-6 border-t border-surface-300 pt-6 lg:border-t-0 lg:pt-0 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
