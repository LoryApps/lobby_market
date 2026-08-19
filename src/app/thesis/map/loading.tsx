import { Skeleton } from '@/components/ui/Skeleton'

export default function ThesisMapLoading() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <div className="h-14 bg-surface-900 border-b border-surface-800" />
      <div className="flex-1 p-4 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="flex-1 rounded-2xl" />
      </div>
    </div>
  )
}
