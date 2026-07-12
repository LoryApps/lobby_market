import { Skeleton } from '@/components/ui/Skeleton'

export default function HallOfFameLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
