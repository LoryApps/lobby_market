import { GitCompare } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-200 ${className ?? ''}`} />
}

export default function LawCompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="px-4 py-6 pb-24 md:pb-12 max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-emerald" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        <div className="flex items-center justify-center py-16">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
