import { Skull } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function GraveyardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
              <Skull className="h-5 w-5 text-surface-500" />
            </div>
            <div>
              <Skeleton className="h-7 w-40 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-4 w-full max-w-2xl mt-2" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-lg" />)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
