import { Loader2 } from 'lucide-react'

export default function RandomLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-950">
      <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
    </div>
  )
}
