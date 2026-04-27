import { Bot } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoachLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Bot className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Topic search */}
        <div className="mb-6 space-y-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Side selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2"
            >
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Compose area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 mb-6">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* Tips strip */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
