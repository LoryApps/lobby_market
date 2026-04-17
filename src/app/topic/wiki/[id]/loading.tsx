import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicWikiLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Breadcrumb */}
        <Skeleton className="h-3.5 w-48 mb-5" />

        {/* Back link */}
        <Skeleton className="h-4 w-28 mb-4" />

        {/* Title */}
        <div className="flex items-start gap-3 mb-3">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-full max-w-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </div>

        {/* Vote bar */}
        <Skeleton className="h-16 w-full rounded-xl mt-4 mb-6" />

        {/* Actions row */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-300">
          <Skeleton className="h-4 w-52" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>

        {/* Wiki content body */}
        <div className="flex gap-6">
          {/* TOC placeholder */}
          <div className="hidden lg:block w-52 flex-shrink-0">
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          {/* Content */}
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="pt-2" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="pt-2" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
