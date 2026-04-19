import { Loader2 } from 'lucide-react'

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
    </div>
  )
}
