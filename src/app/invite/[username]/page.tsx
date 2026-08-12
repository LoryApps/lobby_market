import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Flame,
  Gavel,
  MessageSquare,
  Shield,
  Users,
  Vote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, bio, total_votes, total_arguments')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Join Lobby Market' }

  const name = profile.display_name ?? profile.username
  const description = profile.bio
    ? `${profile.bio.slice(0, 140)} — Join ${name} on Lobby Market, the civic debate platform where voices become law.`
    : `${name} invites you to Lobby Market — vote on today's debates, back your view with arguments, and watch consensus form in real time.`

  return {
    title: `${name} invites you to Lobby Market`,
    description,
    openGraph: {
      title: `${name} invites you to Lobby Market`,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: profile.avatar_url
        ? [{ url: profile.avatar_url, width: 200, height: 200, alt: name }]
        : [],
    },
    twitter: {
      card: 'summary',
      title: `${name} invites you to Lobby Market`,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  }
}

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Vote
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/40 flex-1">
      <Icon className={cn('h-4 w-4', color)} aria-hidden />
      <span className="text-lg font-mono font-bold text-white tabular-nums">{value}</span>
      <span className="text-[9px] font-mono font-semibold text-surface-600 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InviteLandingPage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, role, clout, total_votes, total_arguments, vote_streak, civic_archetype, civic_oath_value, followers_count, created_at'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const typedProfile = profile as Profile & {
    civic_archetype?: string | null
    civic_oath_value?: string | null
    followers_count?: number
  }

  const name = typedProfile.display_name ?? typedProfile.username
  const roleLabel = ROLE_LABEL[typedProfile.role] ?? 'Citizen'
  const memberYear = new Date(typedProfile.created_at).getFullYear()

  // Log the invite visit for authenticated visitors (best-effort, direct Supabase insert)
  const { data: { user: visitor } } = await supabase.auth.getUser()
  if (visitor && visitor.id !== typedProfile.id) {
    await supabase.from('civic_referrals').insert({
      referrer_id: typedProfile.id,
      invite_code: params.username,
      referee_id: visitor.id,
      completed_at: new Date().toISOString(),
    }).catch(() => {})
  }

  const PERKS = [
    {
      icon: Vote,
      title: 'Vote on today\'s debates',
      desc: 'Cast FOR or AGAINST on live civic topics — every vote moves the needle.',
      color: 'text-for-400',
      bg: 'bg-for-500/10',
    },
    {
      icon: MessageSquare,
      title: 'Back your view with arguments',
      desc: 'Write and rate arguments. The best reasoning wins, not the loudest voice.',
      color: 'text-purple',
      bg: 'bg-purple/10',
    },
    {
      icon: Gavel,
      title: 'Help make laws',
      desc: 'Topics that hit supermajority consensus become platform laws — you\'re part of that.',
      color: 'text-gold',
      bg: 'bg-gold/10',
    },
    {
      icon: Shield,
      title: 'Earn civic reputation',
      desc: 'Your Clout, streak, and skill tree reflect your real engagement — no gaming the system.',
      color: 'text-emerald',
      bg: 'bg-emerald/10',
    },
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Subtle header bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-surface-300/60">
        <Link href="/" className="flex flex-col items-start">
          <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
          <div className="flex h-0.5 w-10 mt-0.5">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
        </Link>
        <Link
          href="/login"
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          Already a member? Sign in →
        </Link>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-10 flex flex-col gap-8">
        {/* Inviter card */}
        <section
          aria-label="Your inviter"
          className="rounded-2xl border border-surface-300/60 bg-surface-100 p-6 flex flex-col items-center text-center gap-3"
        >
          <Avatar
            src={typedProfile.avatar_url}
            fallback={name}
            size="lg"
            className="ring-2 ring-gold/30"
          />
          <div>
            <h1 className="text-xl font-bold text-white">{name}</h1>
            <p className="text-sm text-surface-500 font-mono">@{typedProfile.username}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Badge variant={typedProfile.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
              {roleLabel}
            </Badge>
            {typedProfile.civic_archetype && (
              <Badge variant="gold" className="text-[10px]">
                {typedProfile.civic_archetype}
              </Badge>
            )}
            <span className="text-[10px] font-mono text-surface-600">Member since {memberYear}</span>
          </div>

          {typedProfile.bio && (
            <p className="text-sm text-surface-400 font-mono leading-relaxed max-w-sm line-clamp-3">
              &ldquo;{typedProfile.bio}&rdquo;
            </p>
          )}

          {/* Stats */}
          <div className="flex gap-2 w-full mt-1">
            <StatPill
              icon={Vote}
              value={(typedProfile.total_votes ?? 0).toLocaleString()}
              label="Votes"
              color="text-for-400"
            />
            <StatPill
              icon={MessageSquare}
              value={(typedProfile.total_arguments ?? 0).toLocaleString()}
              label="Arguments"
              color="text-purple"
            />
            <StatPill
              icon={Flame}
              value={typedProfile.vote_streak ?? 0}
              label="Streak"
              color="text-gold"
            />
            <StatPill
              icon={Users}
              value={(typedProfile.followers_count ?? 0).toLocaleString()}
              label="Followers"
              color="text-emerald"
            />
          </div>

          {typedProfile.civic_oath_value && (
            <p className="text-[11px] font-mono text-gold/70 italic mt-1">
              Civic value: &ldquo;{typedProfile.civic_oath_value}&rdquo;
            </p>
          )}
        </section>

        {/* Invite message */}
        <section className="text-center">
          <p className="text-2xl font-bold text-white leading-snug mb-2">
            {name} invites you to shape tomorrow&apos;s laws.
          </p>
          <p className="text-sm text-surface-400 font-mono max-w-sm mx-auto">
            Lobby Market is where civic debates happen — vote, argue, predict, and watch consensus turn into real-world policy.
          </p>
        </section>

        {/* Perks */}
        <section className="flex flex-col gap-3" aria-label="Why join">
          {PERKS.map(({ icon: Icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-200/40"
            >
              <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', bg)}>
                <Icon className={cn('h-4 w-4', color)} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-surface-500 mt-0.5 font-mono">{desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/onboarding?ref=${typedProfile.username}`}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-3.5 rounded-xl',
              'bg-for-600 hover:bg-for-500 text-white font-mono font-bold text-sm',
              'transition-colors shadow-lg shadow-for-900/30',
            )}
          >
            Join {name} on Lobby Market
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="text-center text-[10px] font-mono text-surface-600">
            Free to join · No ads · Open to everyone
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-surface-300/40">
        <p className="text-[10px] font-mono text-surface-700">
          Already have an account?{' '}
          <Link href="/login" className="text-surface-500 hover:text-white transition-colors underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  )
}
