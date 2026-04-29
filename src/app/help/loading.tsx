import { HelpCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HelpLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Search bar */}
        <Skeleton className="h-11 w-full rounded-xl mb-8" />

        {/* FAQ sections */}
        {Array.from({ length: 4 }).map((_, s) => (
          <div key={s} className="mb-8">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  {i === 0 && (
                    <div className="space-y-1 pt-1">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-5/6" />
                    </div>
                  )}
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
