import { Building2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CityUsernameLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Building2 className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>

        {/* Focused profile banner */}
        <div className="rounded-2xl bg-surface-100 border border-for-500/30 p-5 mb-5 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg flex-shrink-0" />
        </div>

        {/* City grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-3"
            >
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="space-y-1.5 w-full text-center">
                <Skeleton className="h-4 w-24 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
