import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
