'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

const CATEGORIES = [
  'Politics',
  'Technology',
  'Ethics',
  'Culture',
  'Economics',
  'Science',
  'Philosophy',
  'Other',
]

const SCOPES = ['Global', 'National', 'Regional', 'Local']

const MAX_CHARS = 280

export default function CreateTopicPage() {
  const router = useRouter()
  const [statement, setStatement] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('Global')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const charCount = statement.length
  const isOverLimit = charCount > MAX_CHARS

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!statement.trim()) {
      newErrors.statement = 'Statement is required'
    } else if (statement.length > MAX_CHARS) {
      newErrors.statement = `Statement must be ${MAX_CHARS} characters or fewer`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          category: category || undefined,
          scope,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setErrors({ form: data.error || 'Failed to create topic' })
        return
      }

      const topic = await res.json()
      router.push(`/topic/${topic.id}`)
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-white">Create Topic</span>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form-level error */}
          {errors.form && (
            <div className="bg-against-600/10 border border-against-600/30 text-against-400 text-sm rounded-lg px-4 py-3">
              {errors.form}
            </div>
          )}

          {/* Statement */}
          <div className="space-y-2">
            <label
              htmlFor="statement"
              className="block text-sm font-medium text-surface-600"
            >
              Statement
            </label>
            <textarea
              id="statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="What should be debated?"
              rows={4}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-lg',
                'bg-surface-200 text-white placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 transition-colors resize-none',
                errors.statement
                  ? 'border-against-500 focus:ring-against-500/30'
                  : 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/20'
              )}
            />
            <div className="flex items-center justify-between">
              {errors.statement && (
                <p className="text-xs text-against-400">{errors.statement}</p>
              )}
              <span
                className={cn(
                  'text-xs ml-auto',
                  isOverLimit ? 'text-against-400' : 'text-surface-500'
                )}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="category"
              className="block text-sm font-medium text-surface-600"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm',
                'bg-surface-200 text-white border-surface-300',
                'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20',
                'transition-colors appearance-none'
              )}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label
              htmlFor="scope"
              className="block text-sm font-medium text-surface-600"
            >
              Scope
            </label>
            <select
              id="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm',
                'bg-surface-200 text-white border-surface-300',
                'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20',
                'transition-colors appearance-none'
              )}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="for"
            size="lg"
            className="w-full"
            disabled={isSubmitting || isOverLimit || !statement.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Propose Topic'}
          </Button>
        </form>
      </div>
    </div>
  )
}
