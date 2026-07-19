import { Skeleton } from '@/components/ui/Skeleton'

export default function GroupDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-5">
        <Skeleton className="h-4 w-28" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </main>
    </div>
  )
}
