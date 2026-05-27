import { Skeleton } from '@/components/ui/Skeleton'

export default function FuturesLoading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <div className="h-14 bg-surface-200 border-b border-surface-300" />
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
