import { Sparkles } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function WrappedLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-6 pb-24 md:pb-12">
        {/* Logo + title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-purple/10 border border-purple/30">
            <Sparkles className="h-6 w-6 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Hero stat card */}
        <div className="w-full max-w-sm rounded-2xl bg-surface-100 border border-surface-300 p-8 space-y-5 mb-6">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-20 w-28 mx-auto rounded-xl" />
          <Skeleton className="h-5 w-48 mx-auto" />
          <Skeleton className="h-3.5 w-64 mx-auto" />
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`rounded-full ${i === 0 ? 'h-2.5 w-2.5' : 'h-2 w-2'}`}
            />
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex gap-3 w-full max-w-xs">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 flex-1 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
