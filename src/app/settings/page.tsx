'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Code2,
  Database,
  Download,
  Eye,
  LogOut,
  Moon,
  Settings,
  Share,
  Shield,
  Smartphone,
  User,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
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
  new_topic_in_tag: boolean
  streak_reminder: boolean
  weekly_digest: boolean
  qa_notifications: boolean
  ama_notifications: boolean
  relay_notifications: boolean
  debate_challenge_notifications: boolean
  law_challenge_notifications: boolean
  law_endorsed_notifications: boolean
  thesis_notifications: boolean
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
  new_topic_in_tag: true,
  streak_reminder: true,
  weekly_digest: true,
  qa_notifications: true,
  ama_notifications: true,
  relay_notifications: true,
  debate_challenge_notifications: true,
  law_challenge_notifications: true,
  law_endorsed_notifications: true,
  thesis_notifications: true,
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
  const [exportLoading, setExportLoading] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Browser notification state
  const [browserNotifPermission, setBrowserNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(false)
  const [browserNotifRequesting, setBrowserNotifRequesting] = useState(false)

  // Web Push state
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()
  const [pushBusy, setPushBusy] = useState(false)
  const [pushTestBusy, setPushTestBusy] = useState(false)
  const [pushTestResult, setPushTestResult] = useState<'sent' | 'error' | null>(null)

  // PWA install state
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const deferredInstallRef = useRef<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const standaloneMode =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    setIsInstalled(standaloneMode)

    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(iosDevice)

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      deferredInstallRef.current = e as unknown as NonNullable<typeof deferredInstallRef.current>
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall as EventListener)
    window.addEventListener('appinstalled', () => setIsInstalled(true))
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as EventListener)
    }
  }, [])

  // Read browser notification permission + enabled state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setBrowserNotifPermission('unsupported')
      return
    }
    setBrowserNotifPermission(window.Notification.permission)
    try {
      setBrowserNotifEnabled(localStorage.getItem('lm_browser_notifs') === 'true')
    } catch {
      setBrowserNotifEnabled(false)
    }
  }, [])

  // Load user + prefs (localStorage first for instant display, then server to sync)
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

      // Show local prefs immediately while server fetch is in-flight
      setPrefs(loadPrefs())
      setLoading(false)

      // Sync from server — overrides localStorage with authoritative values
      try {
        const res = await fetch('/api/notification-prefs')
        if (res.ok) {
          const serverPrefs = (await res.json()) as Partial<NotifPrefs>
          const merged: NotifPrefs = { ...DEFAULT_PREFS, ...serverPrefs }
          savePrefs(merged) // write server truth back to localStorage
          setPrefs(merged)
        }
      } catch {
        // Server unavailable — keep localStorage values
      }
    }

    load()
  }, [router])

  function updatePref(key: keyof NotifPrefs, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      savePrefs(next)

      // Persist to server (best-effort, no await)
      fetch('/api/notification-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {})

      // Flash "saved" banner
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSavedBanner(true)
      saveTimer.current = setTimeout(() => setSavedBanner(false), 2000)

      return next
    })
  }

  async function requestBrowserNotifications() {
    if (browserNotifRequesting) return
    if (!('Notification' in window)) return
    setBrowserNotifRequesting(true)
    try {
      const result = await window.Notification.requestPermission()
      setBrowserNotifPermission(result)
      if (result === 'granted') {
        try { localStorage.setItem('lm_browser_notifs', 'true') } catch {}
        setBrowserNotifEnabled(true)
        // Fire a test notification so the user sees it working
        new window.Notification('Lobby Market', {
          body: 'Browser notifications enabled. You\'ll see alerts when new activity arrives.',
          icon: '/assets/logo-mark.png',
          badge: '/assets/logo-mark.png',
        })
      }
    } catch {
      // requestPermission may throw in some environments
    } finally {
      setBrowserNotifRequesting(false)
    }
  }

  function toggleBrowserNotifEnabled(value: boolean) {
    try { localStorage.setItem('lm_browser_notifs', value ? 'true' : 'false') } catch {}
    setBrowserNotifEnabled(value)
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleExportData() {
    if (exportLoading) return
    setExportLoading(true)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `lobby-market-export-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Non-fatal
    } finally {
      setExportLoading(false)
    }
  }

  function handleCopyEmbed() {
    if (!user) return
    const code = `<iframe src="https://lobby.market/api/embed/profile/${user.username}" width="320" height="280" frameborder="0" style="border-radius:12px;overflow:hidden"></iframe>`
    navigator.clipboard.writeText(code).then(() => {
      setEmbedCopied(true)
      setTimeout(() => setEmbedCopied(false), 2000)
    }).catch(() => {/* clipboard unavailable */})
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
                  label="My Week"
                  description="This week's votes, laws you helped pass, and achievements"
                  href="/my-week"
                />
                <LinkRow
                  label="View my analytics"
                  description="Voting stats, accuracy, and activity trends"
                  href="/analytics"
                />
                <LinkRow
                  label="Vote Alignment Intelligence"
                  description="How your votes align with platform consensus"
                  href="/prescient"
                />
                <LinkRow
                  label="My profile page"
                  description="See how others see your profile"
                  href="/profile/me"
                />
                {user?.username && (
                  <LinkRow
                    label="Lobby Card"
                    description="Your shareable civic bio link — perfect for social profiles"
                    href={`/u/${user.username}`}
                  />
                )}
              </div>
            </div>

            {/* ── Notifications ─────────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Bell} title="Notifications" />
              <p className="text-xs text-surface-500 mb-4">
                Control which notification types appear in your bell and feed.
                Preferences sync across all your devices.
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
                  label="Topic & bookmark updates"
                  description="When a topic goes active, and when a saved topic changes status"
                  checked={prefs.topic_activated}
                  onChange={(v) => updatePref('topic_activated', v)}
                />
                <SettingRow
                  label="Vote milestones & final voting"
                  description="When a topic you voted on enters final voting or hits a vote threshold"
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
                <SettingRow
                  label="New topics in followed tags"
                  description="When a new debate is created in a tag you follow"
                  checked={prefs.new_topic_in_tag}
                  onChange={(v) => updatePref('new_topic_in_tag', v)}
                />
                <SettingRow
                  label="Streak reminder"
                  description="Alert at 8 PM UTC when your vote streak is at risk of breaking"
                  checked={prefs.streak_reminder ?? true}
                  onChange={(v) => updatePref('streak_reminder', v)}
                />
                <SettingRow
                  label="Weekly digest"
                  description="Monday morning summary of your votes, arguments, and laws from the past 7 days"
                  checked={prefs.weekly_digest ?? true}
                  onChange={(v) => updatePref('weekly_digest', v)}
                />
                <SettingRow
                  label="Q&A notifications"
                  description="When someone answers your question or accepts your answer as best"
                  checked={prefs.qa_notifications ?? true}
                  onChange={(v) => updatePref('qa_notifications', v)}
                />
                <SettingRow
                  label="AMA notifications"
                  description="When a host answers your AMA question or a session you RSVP'd to goes live"
                  checked={prefs.ama_notifications ?? true}
                  onChange={(v) => updatePref('ama_notifications', v)}
                />
                <SettingRow
                  label="Relay notifications"
                  description="When someone joins your relay chain, your relay completes, or gets voted on"
                  checked={prefs.relay_notifications ?? true}
                  onChange={(v) => updatePref('relay_notifications', v)}
                />
                <SettingRow
                  label="Debate challenge notifications"
                  description="When someone challenges you to a debate, or accepts or declines your challenge"
                  checked={prefs.debate_challenge_notifications ?? true}
                  onChange={(v) => updatePref('debate_challenge_notifications', v)}
                />
                <SettingRow
                  label="Law challenge notifications"
                  description="When citizens vote to support your formal challenge to an established law"
                  checked={prefs.law_challenge_notifications ?? true}
                  onChange={(v) => updatePref('law_challenge_notifications', v)}
                />
                <SettingRow
                  label="Law endorsement alerts"
                  description="When citizens endorse a law that originated from your topic — at 1, 5, 10, 25, and 50 endorsements"
                  checked={prefs.law_endorsed_notifications ?? true}
                  onChange={(v) => updatePref('law_endorsed_notifications', v)}
                />
                <SettingRow
                  label="Thesis interactions"
                  description="When someone agrees, disagrees, or comments on your civic thesis — vote milestones at 1, 5, 10, 25, and 50"
                  checked={prefs.thesis_notifications ?? true}
                  onChange={(v) => updatePref('thesis_notifications', v)}
                />
              </div>
            </div>

            {/* ── Browser Notifications ─────────────────────────────────── */}
            {browserNotifPermission !== 'unsupported' && (
              <div className={cardClass}>
                <SectionHeader icon={BellRing} title="Browser Notifications" />
                <p className="text-xs text-surface-500 mb-4">
                  Get OS-level alerts even when the Lobby tab is in the background.
                  Works whenever your browser is open.
                </p>

                {browserNotifPermission === 'denied' && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-against-500/10 border border-against-500/20 mb-3">
                    <X className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-against-300">Blocked by browser</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Open your browser&rsquo;s site settings and allow notifications for lobby.market, then reload this page.
                      </p>
                    </div>
                  </div>
                )}

                {browserNotifPermission === 'granted' && (
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-surface-300">
                    <label className="flex-1 cursor-pointer">
                      <span className="block text-sm font-medium text-white">Enable browser alerts</span>
                      <span className="block text-xs text-surface-500 mt-0.5">
                        Show OS notifications for achievements, laws, debate starts, and replies
                      </span>
                    </label>
                    <button
                      role="switch"
                      aria-checked={browserNotifEnabled}
                      onClick={() => toggleBrowserNotifEnabled(!browserNotifEnabled)}
                      className={cn(
                        'relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
                        browserNotifEnabled ? 'bg-for-600' : 'bg-surface-400'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                          browserNotifEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                )}

                {browserNotifPermission === 'granted' && browserNotifEnabled && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-emerald">
                    <Check className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Browser notifications active</span>
                  </div>
                )}

                {browserNotifPermission === 'default' && (
                  <button
                    type="button"
                    onClick={requestBrowserNotifications}
                    disabled={browserNotifRequesting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                      'bg-for-600/20 border border-for-600/40 text-for-300',
                      'hover:bg-for-600/30 hover:text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40'
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    {browserNotifRequesting ? 'Requesting…' : 'Enable browser notifications'}
                  </button>
                )}
              </div>
            )}

            {/* ── Web Push Notifications ────────────────────────────────── */}
            {pushState !== 'unsupported' && (
              <div className={cardClass}>
                <SectionHeader icon={Bell} title="Push Notifications" />
                <p className="text-xs text-surface-500 mb-4">
                  Receive notifications on this device even when Lobby Market isn&rsquo;t open — for debates, laws, replies, and achievements.
                </p>

                {pushState === 'blocked' && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-against-500/10 border border-against-500/20 mb-3">
                    <X className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-against-300">Blocked by browser</p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Open your browser&rsquo;s site settings and allow notifications for lobby.market, then reload.
                      </p>
                    </div>
                  </div>
                )}

                {pushState === 'subscribed' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-emerald">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Push notifications active on this device</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        disabled={pushTestBusy}
                        onClick={async () => {
                          setPushTestBusy(true)
                          setPushTestResult(null)
                          try {
                            const res = await fetch('/api/push/test', { method: 'POST' })
                            setPushTestResult(res.ok ? 'sent' : 'error')
                          } catch {
                            setPushTestResult('error')
                          } finally {
                            setPushTestBusy(false)
                            setTimeout(() => setPushTestResult(null), 4000)
                          }
                        }}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-colors',
                          'bg-surface-200 border border-surface-300 text-surface-600',
                          'hover:bg-surface-300 hover:text-white disabled:opacity-50'
                        )}
                      >
                        <BellRing className="h-3 w-3" />
                        {pushTestBusy ? 'Sending…' : 'Send test notification'}
                      </button>
                      {pushTestResult === 'sent' && (
                        <span className="text-xs text-emerald font-mono flex items-center gap-1">
                          <Check className="h-3 w-3" /> Sent!
                        </span>
                      )}
                      {pushTestResult === 'error' && (
                        <span className="text-xs text-against-400 font-mono">Failed — check VAPID keys.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={pushBusy}
                      onClick={async () => {
                        setPushBusy(true)
                        await pushUnsubscribe()
                        setPushBusy(false)
                      }}
                      className="text-xs text-surface-500 hover:text-against-400 transition-colors disabled:opacity-50"
                    >
                      {pushBusy ? 'Disabling…' : 'Disable push notifications'}
                    </button>
                  </div>
                )}

                {(pushState === 'not_subscribed' || pushState === 'error') && (
                  <button
                    type="button"
                    disabled={pushBusy || pushState === 'loading'}
                    onClick={async () => {
                      setPushBusy(true)
                      await pushSubscribe()
                      setPushBusy(false)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                      'bg-for-600/20 border border-for-600/40 text-for-300',
                      'hover:bg-for-600/30 hover:text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40'
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    {pushBusy || pushState === 'loading' ? 'Enabling…' : 'Enable push notifications'}
                  </button>
                )}

                {pushState === 'error' && (
                  <p className="text-xs text-against-400 mt-2">
                    Failed to enable push notifications. Make sure you&rsquo;ve allowed notifications for this site.
                  </p>
                )}
              </div>
            )}

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

            {/* ── Install app ───────────────────────────────────────────── */}
            {!isInstalled && (
              <div className={cardClass}>
                <SectionHeader icon={Smartphone} title="Install App" />
                <div className="py-3">
                  {isIOS ? (
                    <div className="space-y-2">
                      <p className="text-sm text-surface-600">
                        To install on iOS, tap the
                        <span className="inline-flex items-center justify-center h-5 w-5 mx-1 rounded bg-surface-300 border border-surface-400">
                          <Share className="h-3 w-3 text-for-400" aria-hidden="true" />
                        </span>
                        Share button in Safari, then choose <strong className="text-white font-medium">&ldquo;Add to Home Screen&rdquo;</strong>.
                      </p>
                    </div>
                  ) : deferredInstallRef.current ? (
                    <div className="space-y-3">
                      <p className="text-sm text-surface-600">
                        Install Lobby Market as a native app for faster load times, offline access, and a full-screen experience.
                      </p>
                      <button
                        onClick={async () => {
                          const prompt = deferredInstallRef.current
                          if (!prompt) return
                          await prompt.prompt()
                          const { outcome } = await prompt.userChoice
                          if (outcome === 'accepted') setIsInstalled(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
                      >
                        <Download className="h-4 w-4" />
                        Install App
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-surface-600">
                      Open Lobby Market in Chrome on Android to install as a native app, or use Safari on iOS.
                    </p>
                  )}
                </div>
              </div>
            )}
            {isInstalled && (
              <div className={cardClass}>
                <SectionHeader icon={Smartphone} title="Install App" />
                <div className="py-3 flex items-center gap-2">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <Smartphone className="h-3.5 w-3.5 text-emerald" />
                  </div>
                  <p className="text-sm text-surface-600">App installed — running in standalone mode.</p>
                </div>
              </div>
            )}

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
                  label="My Positions"
                  description="Every topic you've voted on with outcome tracking"
                  href="/positions"
                />
                <LinkRow
                  label="Voting history"
                  description="View your vote timeline on your profile"
                  href="/profile/me"
                />
                <LinkRow
                  label="Vote Delegation"
                  description="Delegate your vote to trusted citizens via Liquid Democracy"
                  href="/delegation"
                />
              </div>
            </div>

            {/* ── Data & Portability ────────────────────────────────────── */}
            <div className={cardClass}>
              <SectionHeader icon={Database} title="Data &amp; Portability" />
              <div>
                {/* Export data */}
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={exportLoading}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-surface-300 group cursor-pointer">
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-white group-hover:text-for-400 transition-colors">
                        {exportLoading ? 'Preparing export…' : 'Export your data'}
                      </span>
                      <span className="block text-xs text-surface-500 mt-0.5">
                        Download all your votes, arguments, achievements, and more as JSON
                      </span>
                    </div>
                    <Download className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors" />
                  </div>
                </button>

                {/* Profile embed */}
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-4 py-3 group cursor-pointer">
                    <div className="flex-1">
                      <span className="block text-sm font-medium text-white group-hover:text-for-400 transition-colors">
                        {embedCopied ? 'Embed code copied!' : 'Copy profile embed code'}
                      </span>
                      <span className="block text-xs text-surface-500 mt-0.5">
                        Embed your civic profile card on any website
                      </span>
                    </div>
                    <Code2 className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors" />
                  </div>
                </button>
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

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-6">
              <a href="/privacy" className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors">Privacy Policy</a>
              <span className="text-surface-700 text-[10px]">·</span>
              <a href="/terms" className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors">Terms of Service</a>
              <span className="text-surface-700 text-[10px]">·</span>
              <a href="/guidelines" className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors">Community Guidelines</a>
            </div>
            <p className="text-center text-[10px] font-mono text-surface-600 mt-2">
              Lobby Market · Built by the community
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
