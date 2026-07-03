import { Skeleton } from '@/components/ui/Skeleton'

export default function AskLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-6 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
