import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentPageLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>

        {/* Side badge */}
        <Skeleton className="h-7 w-28 rounded-full mb-4" />

        {/* Argument content card */}
        <div className="rounded-2xl border border-surface-300 p-6 mb-6 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/4" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14 ml-auto" />
        </div>

        {/* Author */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-surface-300 mb-6">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Topic context */}
        <div className="rounded-2xl border border-surface-300 overflow-hidden mb-6">
          <div className="bg-surface-100 px-4 py-2.5 border-b border-surface-300">
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-2 w-full rounded-full mt-3" />
          </div>
        </div>

        {/* CTA */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
