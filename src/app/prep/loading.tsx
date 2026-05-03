import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PrepLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-9 w-9 rounded-lg bg-surface-300" />
          <div>
            <div className="h-6 w-36 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-52 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Topic search */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-24 bg-surface-300 rounded mb-3" />
          <div className="h-10 bg-surface-200 rounded-lg" />
        </div>

        {/* Side selector */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-20 bg-surface-300 rounded mb-3" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 bg-for-500/20 rounded-xl" />
            <div className="h-16 bg-against-500/20 rounded-xl" />
          </div>
        </div>

        {/* Dossier sections */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-surface-300" />
              <div className="h-5 w-32 bg-surface-300 rounded" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 bg-surface-300 rounded" style={{ width: `${85 - j * 8}%` }} />
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
