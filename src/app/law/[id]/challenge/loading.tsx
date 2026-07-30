import { Skeleton } from '@/components/ui/Skeleton'

export default function LawChallengeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
