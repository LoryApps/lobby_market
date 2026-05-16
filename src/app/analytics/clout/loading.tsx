import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function CloutAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Skel className="h-9 w-9 rounded-xl" />
          <Skel className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skel className="h-6 w-36" />
            <Skel className="h-3 w-52" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
              <Skel className="h-3 w-16" />
              <Skel className="h-8 w-20" />
              <Skel className="h-3 w-12" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4">
              <Skel className="h-12 w-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-16" />
                <Skel className="h-6 w-12" />
                <Skel className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <Skel className="h-4 w-40 mb-5" />
          <Skel className="h-28 w-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
              <Skel className="h-4 w-36 mb-2" />
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between">
                    <Skel className="h-3 w-32" />
                    <Skel className="h-3 w-10" />
                  </div>
                  <Skel className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
