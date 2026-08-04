import { Skeleton } from '@/components/ui/Skeleton'

export default function ForgotPasswordLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3 pt-1">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  )
}
