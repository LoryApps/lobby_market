import { Skeleton } from '@/components/ui/Skeleton'

export default function GroupsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-7 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
