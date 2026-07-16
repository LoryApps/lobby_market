import { Skeleton } from '@/components/ui/Skeleton'

export default function LiquidityLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <div className="h-14 border-b border-surface-200 bg-surface-950" />
      <div className="px-4 pt-4 pb-5 border-b border-surface-200">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
      <div className="border-b border-surface-200 flex gap-2 px-4 py-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-24 rounded" />)}
      </div>
      <div className="divide-y divide-surface-200">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-4">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
