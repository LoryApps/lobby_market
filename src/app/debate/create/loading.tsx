import { Mic } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateCreateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <Mic className="h-5 w-5 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>

        {/* Step 1: Debate type */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Topic search */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Step 3: Title + description */}
        <div className="mb-8 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>

        {/* Submit */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
