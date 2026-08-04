import { Skeleton } from '@/components/ui/Skeleton'

export default function LoginLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3 pt-1">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <Skeleton className="h-4 w-40 mx-auto" />
    </div>
  )
}
