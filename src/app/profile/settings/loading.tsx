import { User } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileSettingsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <User className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>

        {/* Avatar uploader */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5 flex flex-col items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Display name */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          {/* Username (readonly) */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          {/* Bio */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>

          {/* Divider */}
          <div className="border-t border-surface-300 pt-4">
            <Skeleton className="h-4 w-28 mb-4" />
            {/* Twitter / GitHub / Website */}
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <Skeleton className="h-10 flex-1 rounded-xl" />
              </div>
            ))}
          </div>

          {/* Email (readonly) */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>

        {/* Save */}
        <div className="mt-8">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
