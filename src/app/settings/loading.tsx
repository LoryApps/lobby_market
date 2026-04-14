import { Settings } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function SettingsCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4 animate-pulse">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-3 w-20" />
      </div>
      {/* Rows */}
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-3 border-b border-surface-300 last:border-0">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 flex-shrink-0">
              <Settings className="h-3.5 w-3.5 text-surface-500" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>

        {/* Account card */}
        <SettingsCardSkeleton />

        {/* Notifications card — more rows */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3 w-full mb-4" />
          <div className="space-y-0">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-3 border-b border-surface-300 last:border-0">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Appearance card */}
        <SettingsCardSkeleton />

        {/* Privacy + session */}
        <SettingsCardSkeleton />
      </main>
      <BottomNav />
    </div>
  )
}
