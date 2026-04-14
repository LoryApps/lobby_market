import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsCreateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Inline top bar */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        {/* Lobby link */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Settings toggles */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>

        {/* Submit */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}
