import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ChronicleLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Newspaper-style header */}
        <div className="mb-8 text-center border-b border-surface-300 pb-6 space-y-3">
          <Skeleton className="h-4 w-32 mx-auto rounded-full" />
          <Skeleton className="h-9 w-56 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Timeline entries */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-8">
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <div className="flex-1 h-px bg-surface-300" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Events */}
            <div className="space-y-3 pl-4 border-l-2 border-surface-300">
              {Array.from({ length: i === 0 ? 3 : 2 }).map((_, j) => (
                <div key={j} className="relative">
                  <div className="absolute -left-[21px] top-3 h-3 w-3 rounded-full bg-surface-300" />
                  <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 ml-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-14 rounded-full flex-shrink-0" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-3 pt-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
