import { Skeleton } from '@/components/ui/Skeleton'

export default function BadgesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <Skeleton className="h-4 w-28 mb-4" />
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>

        {/* User selector */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="flex gap-2 mb-3">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-9 rounded-lg" />
        </div>

        {/* Badge preview placeholder */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          <Skeleton className="h-4 w-28 mb-4" />
          <Skeleton className="h-[130px] w-full rounded-xl mb-4" />
          <Skeleton className="h-10 rounded-lg" />
        </div>

        {/* Embed codes */}
        <div className="space-y-4 mb-6">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-200 border-b border-surface-300">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-full rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
