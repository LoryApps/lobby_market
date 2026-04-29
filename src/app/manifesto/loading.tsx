import { Scroll } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ManifestoLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Scroll className="h-5 w-5 text-gold" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>

        {/* Profile strip */}
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Position cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full flex-shrink-0" />
              </div>
              {i % 2 === 0 && <Skeleton className="h-3 w-24 ml-8" />}
            </div>
          ))}
        </div>

        {/* Generate button */}
        <Skeleton className="h-12 w-full rounded-xl mt-6" />
      </main>
      <BottomNav />
    </div>
  )
}
