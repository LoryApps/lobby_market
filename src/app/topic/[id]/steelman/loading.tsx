import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SteelmanLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-4">
        {/* Back link + breadcrumb */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>

        {/* Statement */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-full rounded" />
          <Skeleton className="h-7 w-3/4 rounded" />
        </div>

        {/* FOR steelman card */}
        <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-5 space-y-3">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <div className="space-y-2 mt-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded mt-3" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>

        {/* AGAINST steelman card */}
        <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-5 space-y-3">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <div className="space-y-2 mt-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded mt-3" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>

        {/* Synthesis card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
