import { Skeleton } from '@/components/ui/Skeleton'

export default function SignalLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-24 rounded-xl" />
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
