import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BriefLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Greeting */}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-36" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2 animate-pulse"
            >
              <Skeleton className="h-4 w-4 rounded mx-auto" />
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Trending topics section */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-start gap-3 animate-pulse"
            >
              <Skeleton className="h-5 w-5 rounded flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Upcoming debates section */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 w-40" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* New laws section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
            <Skeleton className="h-4 w-28" />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-gold/5 border border-gold/20 p-4 space-y-2 animate-pulse"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
