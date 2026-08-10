import { Skeleton } from '@/components/ui/Skeleton'

export default function BreakthroughLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        <div className="mb-6">
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="flex gap-2 mb-5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </main>
    </div>
  )
}
