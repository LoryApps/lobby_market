import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function DocSection() {
  return (
    <div className="space-y-3 py-5 border-b border-surface-300 last:border-0">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

export default function PrivacyLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-10 pb-28 md:pb-12">
        {/* Document header */}
        <div className="mb-8 pb-6 border-b border-surface-300 space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        {/* Table of contents */}
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 mb-8 space-y-2">
          <Skeleton className="h-4 w-32 mb-3" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-48" />
          ))}
        </div>

        {/* Document sections */}
        {Array.from({ length: 7 }).map((_, i) => (
          <DocSection key={i} />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
