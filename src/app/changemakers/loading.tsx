import { Skeleton } from '@/components/ui/Skeleton'

export default function ChangemakersLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-950 pb-20">
      <div className="sticky top-0 z-30 bg-surface-950/90 backdrop-blur border-b border-surface-800 px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="px-4 pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-8 rounded-full" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
