import { Skeleton } from '@/components/ui/Skeleton'

export default function HourglassLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300/30" />
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-24 space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-96" />
        <div className="space-y-4 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
