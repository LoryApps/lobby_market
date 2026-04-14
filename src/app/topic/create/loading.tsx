import { FileText } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicCreateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <FileText className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Statement field */}
        <div className="mb-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-3 w-36" />
        </div>

        {/* Description / context */}
        <div className="mb-5 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        {/* Category picker */}
        <div className="mb-5 space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Scope toggle */}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        {/* Submit */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
