import { Skeleton } from '@/components/ui/Skeleton'

function ReplySkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-12 flex-shrink-0" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="rounded-lg bg-surface-200/60 px-3 py-2 space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

export default function ArgumentRepliesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100" />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <ReplySkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  )
}
