import { Skeleton } from '@/components/ui/Skeleton'

export default function LawVerdictLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">
        <Skeleton className="h-5 w-20 rounded" />
        <Skeleton className="h-8 w-52 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
