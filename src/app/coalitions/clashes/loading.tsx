import { Swords } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ClashesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Swords className="h-5 w-5 text-against-400" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-48 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>
        </div>

        <Skeleton className="h-10 w-full rounded-xl" />

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex flex-col items-end">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
