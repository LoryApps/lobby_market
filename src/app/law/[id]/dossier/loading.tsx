import { Skeleton } from '@/components/ui/Skeleton'

export default function LawDossierLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300/60" />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-4">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2 w-14" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
        </div>

        {/* Vote record */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-2.5 w-28" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
