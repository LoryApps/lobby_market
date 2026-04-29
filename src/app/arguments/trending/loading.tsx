import { TrendingUp } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TrendingArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 pb-24 pt-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <Skeleton className="h-8 w-20 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-18 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-14 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-20 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-18 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-14 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
        </div>

        {/* Two-column FOR / AGAINST */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <section key={col}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
                  >
                    {/* Heat badge + author */}
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    {/* Content lines */}
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    {/* Topic link + upvotes */}
                    <div className="flex items-center justify-between pt-1">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
