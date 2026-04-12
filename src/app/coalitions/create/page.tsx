'use client'

import { ArrowLeft, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CoalitionBuilder } from '@/components/lobby/CoalitionBuilder'

export default function CreateCoalitionPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-purple" />
            New Coalition
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <CoalitionBuilder />
      </div>
    </div>
  )
}
