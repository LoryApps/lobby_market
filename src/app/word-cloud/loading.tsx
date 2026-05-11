import { Type } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function CloudPanelSkeleton({ side }: { side: 'for' | 'against' }) {
  const borderColor = side === 'for' ? 'border-for-500/20' : 'border-against-500/20'
  return (
    <div className={`flex-1 rounded-2xl border p-5 ${borderColor}`}>
      <Skeleton className="h-12 w-full rounded-xl mb-5" />
      <div className="flex flex-wrap gap-3 justify-center">
        {Array.from({ length: 28 }, (_, i) => (
          <Skeleton
            key={i}
            className="rounded"
            style={{
              height: `${10 + (i % 5) * 6}px`,
              width: `${28 + (i % 7) * 14}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function WordCloudLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-20 md:pb-8">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-5">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-purple" aria-hidden />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-14" />
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-3 w-14" />
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 11 }).map((_, i) => (
                <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${40 + (i % 4) * 15}px` }} />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-5" />
        <div className="flex flex-col md:flex-row gap-5">
          <CloudPanelSkeleton side="for" />
          <CloudPanelSkeleton side="against" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
