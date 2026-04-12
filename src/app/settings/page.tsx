'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Eye,
  LogOut,
  Moon,
  Settings,
  Shield,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserInfo {
  email: string
  username: string
  displayName: string | null
  role: string
}

// ─── Notification preference keys stored in localStorage ─────────────────────

const NOTIF_PREFS_KEY = 'lm_notif_prefs'

interface NotifPrefs {
  achievement_earned: boolean
  debate_starting: boolean
  law_established: boolean
  topic_activated: boolean
  vote_threshold: boolean
  reply_received: boolean
  role_promoted: boolean
  lobby_update: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  achievement_earned: true,
  debate_starting: true,
  law_established: true,
  topic_activated: true,
  vote_threshold: true,
  reply_received: true,
  role_promoted: true,
  lobby_update: false,
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefs(prefs: NotifPrefs) {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // best-effort
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Settings
  title: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
      </div>
      <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
        {title}
      </h2>
    </div>
  )
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-surface-300 last:border-0">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && (
          <span className="block text-xs text-surface-500 mt-0.5">{description}</span>
        )}
      </label>
      {/* Toggle switch */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-for-500/40',
          checked ? 'bg-for-600' : 'bg-surface-400'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}

function LinkRow({
  label,
  description,
  href,
  onClick,
  danger,
}: {
  label: string
  description?: string
  href?: string
  onClick?: () => void
  danger?: boolean
}) {
  const inner = (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3 border-b border-surface-300 last:border-0 group cursor-pointer'
      )}
    >
      <div className="flex-1">
        <span
          className={cn(
            'block text-sm font-medium transition-colors',
            danger
              ? 'text-against-400 group-hover:text-against-300'
              : 'text-white group-hover:text-for-400'
          )}
        >
          {label}
        </span>
        {description && (
          <span className="block text-xs text-surface-500 mt-0.5">{description}</span>
        )}
      </div>
      {!danger && (
        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors" />
      )}
      {danger && (
        <LogOut className="h-4 w-4 text-against-500 flex-shrink-0" />
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [signingOut, setSigningOut] = useState(false)
  const [savedBanner, setSavedBanner] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load user + prefs
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, role')
        .eq('id', authUser.id)
        .maybeSingle()

      setUser({
        email: authUser.email ?? '',
        username: profile?.username ?? '',
        displayName: profile?.display_name ?? null,
        role: profile?.role ?? 'person',
      })

      setPrefs(loadPrefs())
      setLoading(false)
    }

    load()
  }, [router])

  function updatePref(key: keyof NotifPrefs, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      savePrefs(next)

      // Flash "saved" banner
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSavedBanner(true)
      saveTimer.current = setTimeout(() => setSavedBanner(false), 2000)

      return next
    })
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cardClass =
    'rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">Settings</h1>
            {user && !loading && (
              <p className="text-xs text-surface-500 mt-0.5">@{user.username}</p>
            )}
          </div>

          {/* Saved banner */}
          <motion.span
            className="ml-auto text-xs font-mono text-emerald"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: savedBanner ? 1 : 0, y: savedBanner ? 0 : -4 }}
            transition={{ duration: 0.2 }}
          >
            Saved
          </motion.span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Account ──────────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={User} title="Account" />
              <div className="space-y-0">
                <LinkRow
                  label="Edit profile"
                  description="Update display name, bio, and avatar"
                  href="/profile/settings"
                />
                {user?.email && (
                  <div className="py-3 border-b border-surface-300">
                    <span className="block text-xs text-surface-500 mb-0.5">Email</span>
                    <span className="text-sm text-surface-700">{user.email}</span>
                  </div>
                )}
                <LinkRow
                  label="View my analytics"
                  description="Voting stats, accuracy, and activity trends"
                  href="/analytics"
                />
                <LinkRow
                  label="My profile page"
                  description="See how others see your profile"
                  href="/profile/me"
                />
              </div>
            </div>

            {/* ── Notifications ─────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Bell} title="Notifications" />
              <p className="text-xs text-surface-500 mb-4">
                Control which notification types appear in your bell and feed.
                Preferences are saved to this device.
              </p>
              <div>
                <SettingRow
                  label="Achievement unlocks"
                  description="Toasts + bell when you earn an achievement"
                  checked={prefs.achievement_earned}
                  onChange={(v) => updatePref('achievement_earned', v)}
                />
                <SettingRow
                  label="Debate starting"
                  description="When a debate you follow is about to begin"
                  checked={prefs.debate_starting}
                  onChange={(v) => updatePref('debate_starting', v)}
                />
                <SettingRow
                  label="Laws established"
                  description="When a topic you voted on becomes law"
                  checked={prefs.law_established}
                  onChange={(v) => updatePref('law_established', v)}
                />
                <SettingRow
                  label="Topic activated"
                  description="When a proposed topic moves to active voting"
                  checked={prefs.topic_activated}
                  onChange={(v) => updatePref('topic_activated', v)}
                />
                <SettingRow
                  label="Vote milestones"
                  description="When a topic hits a significant vote threshold"
                  checked={prefs.vote_threshold}
                  onChange={(v) => updatePref('vote_threshold', v)}
                />
                <SettingRow
                  label="Replies"
                  description="When someone replies to your debate argument"
                  checked={prefs.reply_received}
                  onChange={(v) => updatePref('reply_received', v)}
                />
                <SettingRow
                  label="Role promotions"
                  description="When your role in the Lobby changes"
                  checked={prefs.role_promoted}
                  onChange={(v) => updatePref('role_promoted', v)}
                />
                <SettingRow
                  label="Lobby updates"
                  description="General lobby activity and announcements"
                  checked={prefs.lobby_update}
                  onChange={(v) => updatePref('lobby_update', v)}
                />
              </div>
            </div>

            {/* ── Appearance ────────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Moon} title="Appearance" />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-white">Dark mode</p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Lobby Market is designed exclusively for dark environments.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-surface-500">Always on</span>
                  <div
                    className="relative h-5 w-9 rounded-full bg-for-600 opacity-60 cursor-not-allowed"
                    title="Dark mode is always enabled"
                  >
                    <span className="absolute top-0.5 translate-x-4 h-4 w-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Privacy ───────────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Shield} title="Privacy" />
              <div>
                <LinkRow
                  label="Coalition memberships"
                  description="Browse and manage coalitions you're in"
                  href="/coalitions"
                />
                <LinkRow
                  label="Voting history"
                  description="View your vote timeline on your profile"
                  href="/profile/me"
                />
              </div>
            </div>

            {/* ── Danger zone ───────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Eye} title="Session" />
              <div>
                <LinkRow
                  label="Sign out"
                  description="End your current session on this device"
                  onClick={handleSignOut}
                  danger
                />
              </div>
              {signingOut && (
                <p className="text-xs text-surface-500 mt-2 font-mono">
                  Signing out…
                </p>
              )}
            </div>

            <p className="text-center text-[10px] font-mono text-surface-600 mt-6">
              Lobby Market · Built by the community
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
