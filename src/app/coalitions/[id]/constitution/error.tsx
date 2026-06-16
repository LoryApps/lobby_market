'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionConstitutionError() {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <h1 className="text-lg font-bold text-white">Failed to load constitution</h1>
        <p className="text-sm text-surface-500 max-w-xs">
          Something went wrong. Please try refreshing the page.
        </p>
        <Link
          href={`/coalitions/${params.id ?? ''}`}
          className="flex items-center gap-1.5 text-sm text-for-400 hover:text-for-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to coalition
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
