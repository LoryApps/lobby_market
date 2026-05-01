import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function SkillNodeSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
        <Skeleton className={`h-4 ${wide ? 'w-32' : 'w-24'}`} />
        <Skeleton className="h-5 w-16 rounded-full ml-auto" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

function BranchSkeleton({ nodeCount = 4, icon = true }: { nodeCount?: number; icon?: boolean }) {
  return (
    <div className="space-y-3">
      {/* Branch header */}
      <div className="flex items-center gap-2 px-1">
        {icon && <Skeleton className="h-5 w-5 rounded flex-shrink-0" />}
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-12 ml-auto" />
      </div>
      {/* Nodes grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: nodeCount }).map((_, i) => (
          <SkillNodeSkeleton key={i} wide={i === 0} />
        ))}
      </div>
    </div>
  )
}

export default function SkillTreeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-surface-100/90 border-b border-surface-300 backdrop-blur-sm">
        <TopBar />
        <div className="max-w-4xl mx-auto flex items-center gap-3 h-12 px-4">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-2 ml-auto">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-8">
        {/* Profile summary bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="grid grid-cols-3 gap-4 flex-shrink-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Role spine */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-200/50 p-3 space-y-2">
                <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
                <Skeleton className="h-3.5 w-20 mx-auto" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Skill branches */}
        {[4, 4, 6, 4, 4].map((count, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <BranchSkeleton nodeCount={count} />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
