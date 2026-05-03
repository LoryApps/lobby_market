import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WidgetLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-9 w-9 rounded-lg bg-surface-300" />
          <div>
            <div className="h-6 w-36 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-56 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Topic search */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-28 bg-surface-300 rounded mb-3" />
          <div className="h-10 bg-surface-200 rounded-lg" />
        </div>

        {/* Size selector */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-20 bg-surface-300 rounded mb-3" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 flex-1 bg-surface-200 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-16 bg-surface-300 rounded mb-4" />
          <div className="h-48 bg-surface-200 rounded-xl" />
        </div>

        {/* Embed code */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 animate-pulse">
          <div className="h-4 w-24 bg-surface-300 rounded mb-3" />
          <div className="h-20 bg-surface-800 rounded-lg" />
          <div className="flex justify-end mt-3">
            <div className="h-8 w-20 bg-surface-300 rounded-lg" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
