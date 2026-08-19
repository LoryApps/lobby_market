import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WriteLoading() {
  return (
    <div className="min-h-screen bg-surface-900">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-28 md:pb-12">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <Skeleton className={`h-7 w-7 rounded-full ${step === 1 ? 'bg-for-500/30' : 'bg-surface-300/30'}`} />
              {step < 3 && <Skeleton className="h-px w-8" />}
            </div>
          ))}
          <Skeleton className="h-4 w-28 ml-2" />
        </div>

        {/* Step 1: Topic search */}
        <div className="rounded-2xl bg-surface-100/60 border border-surface-300/60 p-5 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          {/* Topic result rows */}
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-14 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
