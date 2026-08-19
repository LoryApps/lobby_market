// Shared types for the Civic Thesis feature
// This file must not import any server-only modules

export type ThesisStatus = 'active' | 'vindicated' | 'refuted' | 'expired'
export type ThesisCategory =
  | 'economics'
  | 'politics'
  | 'technology'
  | 'science'
  | 'ethics'
  | 'philosophy'
  | 'culture'
  | 'health'
  | 'environment'
  | 'education'

export const THESIS_CATEGORIES: ThesisCategory[] = [
  'economics',
  'politics',
  'technology',
  'science',
  'ethics',
  'philosophy',
  'culture',
  'health',
  'environment',
  'education',
]

export interface ThesisAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface Thesis {
  id: string
  user_id: string
  statement: string
  rationale: string | null
  category: string
  resolution_date: string | null
  status: ThesisStatus
  related_topic_id: string | null
  agree_count: number
  disagree_count: number
  is_public: boolean
  resolved_at: string | null
  created_at: string
  updated_at: string
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_statement: string | null
}

export interface ThesisListResponse {
  theses: Thesis[]
  total: number
  stats: {
    total_active: number
    total_vindicated: number
    total_refuted: number
  }
}
