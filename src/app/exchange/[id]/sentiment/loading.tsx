import { Skeleton } from '@/components/ui/Skeleton'

export default function SentimentLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-5">
            <Skeleton className="h-24 w-32 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-5 w-44 rounded-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-2.5 border-b border-surface-300/30 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-12 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
