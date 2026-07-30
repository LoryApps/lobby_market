'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawConnectionsError() {
  const params = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-white mb-2">Could not load connections</h1>
        <p className="text-surface-500 text-sm mb-6">Something went wrong. Please try again.</p>
        <Link
          href={`/law/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-for-400 hover:text-for-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to law
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
