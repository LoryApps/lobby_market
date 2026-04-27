import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentGraphLoading() {
  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="h-14 bg-surface-100 border-b border-surface-300 flex items-center px-4 gap-3 flex-shrink-0">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-3.5 w-64" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 p-4">
        <div className="h-full rounded-xl bg-surface-100 border border-surface-300 flex items-center justify-center">
          <p className="text-surface-500 font-mono text-sm">Loading argument graph…</p>
        </div>
      </div>
    </div>
  )
}
