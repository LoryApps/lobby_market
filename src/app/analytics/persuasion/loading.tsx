import { Skeleton } from '@/components/ui/Skeleton'

export default function PersuasionLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      {/* TopBar */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-6 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg ml-auto" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Tier card */}
        <Skeleton className="h-36 rounded-2xl mb-4" />

        {/* Side comparison */}
        <Skeleton className="h-52 rounded-2xl mb-6" />

        {/* Top arguments */}
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="space-y-3 mb-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        {/* Categories */}
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="space-y-2 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>

      {/* BottomNav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-100 border-t border-surface-300 flex items-center justify-around px-2 md:hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
