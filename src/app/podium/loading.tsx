import { Loader2 } from 'lucide-react'

export default function PodiumLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50">
      <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
    </div>
  )
}
