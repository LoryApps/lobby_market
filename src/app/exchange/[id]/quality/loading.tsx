import { Skeleton } from '@/components/ui/Skeleton'

export default function QualityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        <Skeleton className="h-6 w-48 mb-1" />
        <Skeleton className="h-4 w-72 mb-8" />
        <Skeleton className="h-36 w-full rounded-2xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
