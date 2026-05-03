'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Calendar, Mail, ArrowLeft, AtSign, Code2, Globe, Sparkles, CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { AvatarUploader } from '@/components/ui/AvatarUploader'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import type { Profile } from '@/lib/supabase/types'
import type { SetupProgress } from '@/app/api/me/setup/route'
import { cn } from '@/lib/utils/cn'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [twitter, setTwitter] = useState('')
  const [github, setGithub] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (data) {
        setProfile(data as Profile)
        setDisplayName(data.display_name ?? '')
        setBio(data.bio ?? '')
        setAvatarUrl(data.avatar_url ?? null)
        const links = data.social_links
        setTwitter(links?.twitter ?? '')
        setGithub(links?.github ?? '')
        setWebsite(links?.website ?? '')
      }
      setLoading(false)
    }

    loadProfile()

    // Fetch setup progress independently — non-blocking
    fetch('/api/me/setup')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SetupProgress | null) => {
        if (data) setSetupProgress(data)
      })
      .catch(() => {})
  }, [router])

  // Called by AvatarUploader after a successful storage upload + profile PATCH
  function handleAvatarUpload(url: string) {
    setAvatarUrl(url)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const socialLinks: { twitter?: string; github?: string; website?: string } = {}
    if (twitter.trim()) socialLinks.twitter = twitter.trim().replace(/^@/, '')
    if (github.trim()) socialLinks.github = github.trim().replace(/^@/, '')
    if (website.trim()) socialLinks.website = website.trim()

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Note: avatar_url is intentionally omitted — it is managed by
        // AvatarUploader independently via its own PATCH call.
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to update profile')
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-surface-300 bg-surface-200 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-500 focus:border-for-500 focus:outline-none focus:ring-1 focus:ring-for-500 transition-colors'

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8">
            <div className="text-sm font-mono text-surface-500">Loading profile…</div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Profile settings</h1>
          <p className="text-sm font-mono text-surface-500 mt-1">
            Update how you appear in Lobby Market.
          </p>
        </div>

        {/* ── Setup progress ─────────────────────────────────────────────────── */}
        {setupProgress && !setupProgress.is_complete && (
          <div className="rounded-2xl border border-for-500/25 bg-for-500/5 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono font-semibold text-for-300 uppercase tracking-wider">
                Civic profile — {setupProgress.completed_count} of {setupProgress.total_count} steps complete
              </p>
              <span className="text-xs font-mono text-surface-500">
                {Math.round((setupProgress.completed_count / setupProgress.total_count) * 100)}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-surface-300 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round((setupProgress.completed_count / setupProgress.total_count) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
                style={{ width: `${Math.round((setupProgress.completed_count / setupProgress.total_count) * 100)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {[
                { id: 'has_display_name' as const, label: 'Display name' },
                { id: 'has_avatar' as const, label: 'Profile photo' },
                { id: 'has_bio' as const, label: 'Short bio' },
                { id: 'has_voted' as const, label: 'First vote' },
                { id: 'has_argued' as const, label: 'First argument' },
                { id: 'onboarding_complete' as const, label: 'Welcome quiz' },
              ].map((step) => {
                const done = !!setupProgress[step.id]
                return (
                  <div key={step.id} className="flex items-center gap-2 text-xs font-mono">
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
                    )}
                    <span className={done ? 'text-surface-500 line-through' : 'text-surface-300'}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Avatar section ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-4">
          <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-5">
            Avatar
          </h2>
          <AvatarUploader
            userId={userId}
            currentUrl={avatarUrl}
            displayName={displayName || null}
            username={profile.username}
            onUpload={handleAvatarUpload}
          />
        </section>

        {/* ── Main form ───────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-2xl border border-surface-300 bg-surface-100 p-6"
        >
          {/* Read-only identity info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-surface-300">
            <div>
              <span className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Username
              </span>
              <div className="text-sm font-mono text-surface-700">
                @{profile.username}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Role
              </span>
              <RoleBadge role={profile.role} size="md" />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                <Mail className="h-3 w-3 inline mr-1" aria-hidden="true" />
                Email
              </span>
              <div className="text-sm font-mono text-surface-700 truncate">
                {email || '—'}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                <Calendar className="h-3 w-3 inline mr-1" aria-hidden="true" />
                Member since
              </span>
              <div className="text-sm font-mono text-surface-700">
                {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label
              htmlFor="display_name"
              className="block text-sm font-medium text-surface-600 mb-1.5"
            >
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              maxLength={64}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              placeholder="Your public name"
            />
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-surface-600 mb-1.5"
            >
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={cn(inputClass, 'resize-none')}
              placeholder="Tell the Lobby who you are…"
            />
            <div className="text-[10px] font-mono text-surface-500 mt-1 text-right">
              {bio.length}/280
            </div>
          </div>

          {/* Social links */}
          <div className="pt-4 border-t border-surface-300">
            <p className="text-sm font-semibold text-surface-600 mb-4">Social links</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <AtSign className="h-4 w-4 text-surface-500" />
                </div>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className={inputClass}
                  placeholder="X / Twitter handle"
                  maxLength={64}
                  aria-label="X / Twitter handle"
                />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Code2 className="h-4 w-4 text-surface-500" />
                </div>
                <input
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  className={inputClass}
                  placeholder="GitHub username"
                  maxLength={64}
                  aria-label="GitHub username"
                />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Globe className="h-4 w-4 text-surface-500" />
                </div>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={inputClass}
                  placeholder="https://yoursite.com"
                  maxLength={256}
                  aria-label="Personal website URL"
                />
              </div>
            </div>
          </div>

          {/* Civic Archetype */}
          <div>
            <span className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
              Civic Archetype
            </span>
            {profile?.civic_archetype && ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId] ? (() => {
              const arch = ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId]
              const AIcon = arch.icon
              return (
                <div className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  arch.bgColor, arch.borderColor
                )}>
                  <div className="flex items-center gap-3">
                    <AIcon className={cn('h-5 w-5 flex-shrink-0', arch.color)} />
                    <div>
                      <p className={cn('text-sm font-mono font-bold', arch.color)}>{arch.name}</p>
                      <p className="text-xs font-mono text-surface-500 italic mt-0.5">&ldquo;{arch.tagline}&rdquo;</p>
                    </div>
                  </div>
                  <Link
                    href="/archetype"
                    className="text-xs font-mono text-surface-500 hover:text-white transition-colors underline underline-offset-2 flex-shrink-0 ml-3"
                  >
                    Retake
                  </Link>
                </div>
              )
            })() : (
              <div className="flex items-center justify-between p-4 rounded-xl border border-surface-300 bg-surface-200/50">
                <p className="text-sm font-mono text-surface-500">You haven&apos;t taken the quiz yet.</p>
                <Link
                  href="/archetype"
                  className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors underline underline-offset-2 flex-shrink-0 ml-3"
                >
                  Take quiz
                </Link>
              </div>
            )}
          </div>

          {/* Status messages */}
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-against-950 border border-against-800 px-4 py-3 text-sm text-against-400"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-lg bg-emerald/10 border border-emerald/30 px-4 py-3 text-sm text-emerald"
            >
              Profile updated successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg bg-for-600 hover:bg-for-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors',
              saving && 'opacity-60 cursor-not-allowed',
            )}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  )
}
