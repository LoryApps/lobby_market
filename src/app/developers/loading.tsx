import { Code2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DevelopersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-10 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-10 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <Code2 className="h-5 w-5 text-emerald" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* API sections */}
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s} className="mb-10">
            <div className="flex items-start gap-3 mb-5">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3.5 w-64" />
              </div>
            </div>

            {/* Code block */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-2 mb-4">
              <Skeleton className="h-4 w-3/5 rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-4 w-3/5 rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>

            {/* Endpoint list */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                  <Skeleton className="h-5 w-12 rounded flex-shrink-0" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-32 ml-auto" />
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
