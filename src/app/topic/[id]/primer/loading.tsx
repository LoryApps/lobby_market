import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PrimerLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-5">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-2.5 w-36 rounded" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-full rounded" />
            <Skeleton className="h-7 w-4/5 rounded" />
          </div>
        </div>

        {/* What is this about */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>

        {/* Community stance */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-12 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-8 w-12 rounded" />
          </div>
        </div>

        {/* Arguments header */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>

        {/* FOR argument */}
        <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>

        {/* AGAINST argument */}
        <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <Skeleton className="h-5 w-40 rounded mx-auto" />
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-36 rounded-xl" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
