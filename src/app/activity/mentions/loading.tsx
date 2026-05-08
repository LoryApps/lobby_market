import { Skeleton } from '@/components/ui/Skeleton'

export default function MentionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-24 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28 rounded" />
            <Skeleton className="h-3.5 w-44 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          {[60, 85, 70, 80, 80, 120].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
            >
              <div className="h-0.5 w-full bg-surface-300" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-16 rounded ml-auto" />
                </div>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-8 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
