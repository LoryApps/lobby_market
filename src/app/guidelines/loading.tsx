import { Shield } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function GuidelinesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <Shield className="h-5 w-5 text-emerald" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* Section cards */}
        {Array.from({ length: 5 }).map((_, s) => (
          <div key={s} className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <Skeleton className="h-6 w-44" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 rounded flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
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
