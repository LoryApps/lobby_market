import { Skeleton } from '@/components/ui/Skeleton'

export default function FilibusterLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <div className="h-14 bg-surface-200/50 border-b border-surface-300/40" />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">
        <div className="flex items-center gap-2.5 mb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-5" />
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
