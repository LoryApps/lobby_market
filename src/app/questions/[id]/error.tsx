'use client'

import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function QuestionThreadError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="rounded-xl border border-against-500/30 bg-against-600/10 p-8 text-center mt-8">
          <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-surface-500 mb-5">This question thread could not be loaded.</p>
          <Link
            href="/questions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-medium text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Questions
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
