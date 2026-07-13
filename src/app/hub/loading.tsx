import { Skeleton } from '@/components/ui/Skeleton'

export default function HubLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300/60" />
      <div className="px-4 py-4 max-w-2xl mx-auto w-full space-y-6">
        <Skeleton className="h-10 rounded-xl" />
        <div className="space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
