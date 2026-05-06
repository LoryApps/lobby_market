import { Fingerprint } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FingerprintLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <Fingerprint className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-2 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
