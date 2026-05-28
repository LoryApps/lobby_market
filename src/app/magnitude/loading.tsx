import { Loader2 } from 'lucide-react'

export default function MagnitudeLoading() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <Loader2 className="h-6 w-6 text-against-400 animate-spin" />
    </div>
  )
}
