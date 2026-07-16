import { GitCompare } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-purple" />
            <Skeleton className="h-5 w-36" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-24 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0 mt-3" />
          <Skeleton className="h-24 flex-1 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-5 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-12 rounded-lg" />)}
              </div>
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
