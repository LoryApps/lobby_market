import { Skeleton } from '@/components/ui/Skeleton'

export default function SignalsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-12 space-y-6">
      <Skeleton className="h-14 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-72" />
    </div>
  )
}
