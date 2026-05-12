'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CritiqueError({ error }: { error: Error }) {
  const params = useParams()
  const argId = params?.id as string | undefined

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-surface-500 font-mono mb-6">{error.message}</p>
        {argId && (
          <Link
            href={`/arguments/${argId}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to argument
          </Link>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
