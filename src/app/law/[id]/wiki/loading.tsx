import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawWikiLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-10" />
        </div>

        {/* Law header */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="h-7 w-4/5" />
            </div>
          </div>
          <div className="ml-12 flex items-center gap-3">
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </div>

        {/* Main content card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-7 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 4 === 3 ? 'w-2/3' : 'w-full'}`} />
          ))}
          <Skeleton className="h-4 w-0" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`b${i}`} className={`h-4 ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`} />
          ))}
        </div>

        {/* Footer cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-24 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
