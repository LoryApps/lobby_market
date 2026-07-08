import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function SectionCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-surface-200 border border-surface-300 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-8 rounded-full ml-auto" />
      </div>
      <div className="divide-y divide-surface-300">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5" style={{ width: `${55 + (i % 3) * 14}%` }} />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CivicCommonsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div>
            <Skeleton className="h-7 w-48 mb-1.5" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Grand Council motions */}
        <SectionCard rows={3} />

        {/* Citizens' Assemblies */}
        <SectionCard rows={2} />

        {/* Open referendums */}
        <SectionCard rows={2} />

        {/* Tribunal cases */}
        <SectionCard rows={2} />
      </main>

      <BottomNav />
    </div>
  )
}
