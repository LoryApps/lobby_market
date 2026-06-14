import { Skeleton } from '@/components/ui/Skeleton'

export default function ReputationLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        {/* Tier pills */}
        <div className="grid grid-cols-6 gap-1.5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        {/* Podium */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
        {/* Rows */}
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
