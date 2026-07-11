import { Skeleton } from '@/components/ui/Skeleton'

export default function DelegateGuideLoading() {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      <div className="h-14 bg-surface-800 border-b border-surface-700" />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <div className="grid grid-cols-2 gap-4 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="flex justify-end mt-8">
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
