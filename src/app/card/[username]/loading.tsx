import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicCardLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-surface-100 border border-surface-300/50 overflow-hidden shadow-2xl shadow-black/60">
          <div className="h-px w-full bg-gradient-to-r from-for-600 via-purple to-against-600" />
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            {/* Avatar + identity */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 py-4 border-y border-surface-300/60">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
              ))}
            </div>
            {/* Vote bar */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            {/* Categories */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
              ))}
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <Skeleton className="h-9 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
        <Skeleton className="h-3 w-32 mx-auto mt-4" />
      </div>
    </div>
  )
}
