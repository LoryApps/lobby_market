import { Skeleton } from '@/components/ui/Skeleton'

export default function RotationLoading() {
  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-28">
        <Skeleton className="h-4 w-24 mb-6" />
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-4 w-full mb-6" />
        <Skeleton className="h-56 rounded-xl mb-5" />
        <div className="flex gap-2 mb-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
