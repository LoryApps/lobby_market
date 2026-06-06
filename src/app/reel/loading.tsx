import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ReelLoading() {
  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      <TopBar />
      {/* Full-screen card skeleton (TikTok-style) */}
      <div className="flex-1 relative flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          {/* Main argument card */}
          <div className="bg-surface-100 border border-surface-300 rounded-3xl p-6 space-y-5">
            {/* Side / topic row */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-px bg-surface-400" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
            {/* Topic statement */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            {/* Argument body */}
            <div className="bg-surface-200/50 rounded-2xl p-4 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-5/6" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            {/* Author row */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-20 rounded-lg flex-shrink-0" />
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-1.5 rounded-full ${i === 0 ? 'w-6' : 'w-1.5'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
