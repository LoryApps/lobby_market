import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicShareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12 animate-pulse">
        {/* Header pill */}
        <div className="flex justify-center mb-8">
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>

        {/* Main card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-4/5" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>

        {/* Author */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 mb-5">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
