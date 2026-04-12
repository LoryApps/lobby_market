import type { Profile } from '@/lib/supabase/types'

/**
 * Seed profiles used when Supabase has no data (e.g. migrations not run,
 * local dev without a backend). Gives the 3D city something to render so
 * you can see the mechanics immediately.
 *
 * Reputation scores span all 7 building tiers:
 *   0-100 tent → 100-500 wooden → 500-1500 stone cottage →
 *   1500-3500 townhouse → 3500-6500 office → 6500-10000 apartment →
 *   10000+ glass skyscraper (influencer)
 */
export const SAMPLE_CITY_USERS: Profile[] = [
  // Elders (top tier)
  makeProfile('sample-elder-1', 'marcus_the_wise', 'Marcus the Wise', 'elder', 24500, 15000, true),
  makeProfile('sample-elder-2', 'cicero', 'Cicero', 'elder', 18200, 8500, true),

  // Influencers
  makeProfile('sample-inf-1', 'stellar_voice', 'Stellar Voice', 'debator', 13400, 6200, true),
  makeProfile('sample-inf-2', 'luminara', 'Luminara', 'debator', 11800, 4500, true),

  // Troll catchers (moderators)
  makeProfile('sample-tc-1', 'shield_bearer', 'Shield Bearer', 'troll_catcher', 8900, 3200, false),
  makeProfile('sample-tc-2', 'guardian_owl', 'Guardian Owl', 'troll_catcher', 7600, 2800, false),
  makeProfile('sample-tc-3', 'iron_judge', 'Iron Judge', 'troll_catcher', 6700, 2100, false),

  // Debators
  makeProfile('sample-deb-1', 'silver_tongue', 'Silver Tongue', 'debator', 5800, 1900, false),
  makeProfile('sample-deb-2', 'counterpoint', 'Counterpoint', 'debator', 4900, 1500, false),
  makeProfile('sample-deb-3', 'socratic_method', 'The Socratic', 'debator', 4200, 1200, false),
  makeProfile('sample-deb-4', 'the_rhetorician', 'Rhetorician', 'debator', 3700, 980, false),
  makeProfile('sample-deb-5', 'polished_argument', 'Polished', 'debator', 3100, 820, false),
  makeProfile('sample-deb-6', 'measured_response', 'Measured', 'debator', 2500, 650, false),

  // People (active)
  makeProfile('sample-ppl-1', 'civicmind', 'Civic Mind', 'person', 1800, 420, false),
  makeProfile('sample-ppl-2', 'the_swing_voter', 'Swing Voter', 'person', 1400, 310, false),
  makeProfile('sample-ppl-3', 'neighborhood_voice', 'Neighborhood', 'person', 1100, 260, false),
  makeProfile('sample-ppl-4', 'pragmatist', 'Pragmatist', 'person', 850, 190, false),
  makeProfile('sample-ppl-5', 'everyday_citizen', 'Everyday', 'person', 620, 140, false),

  // People (newer)
  makeProfile('sample-new-1', 'curious_newcomer', 'Curious', 'person', 380, 80, false),
  makeProfile('sample-new-2', 'first_timer', 'First Timer', 'person', 220, 45, false),
  makeProfile('sample-new-3', 'just_arrived', 'Just Arrived', 'person', 150, 30, false),
  makeProfile('sample-new-4', 'learning_the_ropes', 'Learning', 'person', 90, 15, false),
  makeProfile('sample-new-5', 'tentative', 'Tentative', 'person', 50, 8, false),
  makeProfile('sample-new-6', 'brand_new', 'Brand New', 'person', 20, 5, false),
]

function makeProfile(
  id: string,
  username: string,
  displayName: string,
  role: Profile['role'],
  reputation: number,
  clout: number,
  isInfluencer: boolean
): Profile {
  const now = new Date().toISOString()
  return {
    id,
    username,
    display_name: displayName,
    avatar_url: null,
    bio: null,
    role,
    clout,
    reputation_score: reputation,
    total_votes: Math.floor(reputation / 5),
    total_arguments: Math.floor(reputation / 20),
    blue_vote_count: Math.floor(reputation / 10),
    red_vote_count: Math.floor(reputation / 10),
    vote_streak: 0,
    daily_votes_used: 0,
    daily_votes_reset_at: now,
    verification_tier: 1,
    is_influencer: isInfluencer,
    created_at: now,
    updated_at: now,
  }
}
