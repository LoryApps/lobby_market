import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function VerdictLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Verdict headline card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Confidence + signals */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Top arguments */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>

        {/* Comparables */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-300/30">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-5 w-10 ml-auto rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
