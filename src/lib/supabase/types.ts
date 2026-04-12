export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: Database["public"]["Enums"]["user_role"];
          clout: number;
          reputation_score: number;
          total_votes: number;
          total_arguments: number;
          blue_vote_count: number;
          red_vote_count: number;
          vote_streak: number;
          daily_votes_used: number;
          daily_votes_reset_at: string;
          verification_tier: number;
          is_influencer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          clout?: number;
          reputation_score?: number;
          total_votes?: number;
          total_arguments?: number;
          blue_vote_count?: number;
          red_vote_count?: number;
          vote_streak?: number;
          daily_votes_used?: number;
          daily_votes_reset_at?: string;
          verification_tier?: number;
          is_influencer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          clout?: number;
          reputation_score?: number;
          total_votes?: number;
          total_arguments?: number;
          blue_vote_count?: number;
          red_vote_count?: number;
          vote_streak?: number;
          daily_votes_used?: number;
          daily_votes_reset_at?: string;
          verification_tier?: number;
          is_influencer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          author_id: string;
          statement: string;
          category: string | null;
          scope: string;
          status: Database["public"]["Enums"]["topic_status"];
          support_count: number;
          activation_threshold: number;
          blue_votes: number;
          red_votes: number;
          total_votes: number;
          blue_pct: number;
          voting_duration_hours: number;
          voting_ends_at: string | null;
          parent_id: string | null;
          connector: string | null;
          chain_depth: number;
          continuation_window_ends_at: string | null;
          continuation_vote_ends_at: string | null;
          feed_score: number;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          statement: string;
          category?: string | null;
          scope?: string;
          status?: Database["public"]["Enums"]["topic_status"];
          support_count?: number;
          activation_threshold?: number;
          blue_votes?: number;
          red_votes?: number;
          total_votes?: number;
          blue_pct?: number;
          voting_duration_hours?: number;
          voting_ends_at?: string | null;
          parent_id?: string | null;
          connector?: string | null;
          chain_depth?: number;
          continuation_window_ends_at?: string | null;
          continuation_vote_ends_at?: string | null;
          feed_score?: number;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          statement?: string;
          category?: string | null;
          scope?: string;
          status?: Database["public"]["Enums"]["topic_status"];
          support_count?: number;
          activation_threshold?: number;
          blue_votes?: number;
          red_votes?: number;
          total_votes?: number;
          blue_pct?: number;
          voting_duration_hours?: number;
          voting_ends_at?: string | null;
          parent_id?: string | null;
          connector?: string | null;
          chain_depth?: number;
          continuation_window_ends_at?: string | null;
          continuation_vote_ends_at?: string | null;
          feed_score?: number;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      continuations: {
        Row: {
          id: string;
          topic_id: string;
          author_id: string;
          text: string;
          connector: "but" | "and";
          boost_count: number;
          endorsement_count: number;
          vote_count: number;
          status: Database["public"]["Enums"]["continuation_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          author_id: string;
          text: string;
          connector: "but" | "and";
          boost_count?: number;
          endorsement_count?: number;
          vote_count?: number;
          status?: Database["public"]["Enums"]["continuation_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          author_id?: string;
          text?: string;
          connector?: "but" | "and";
          boost_count?: number;
          endorsement_count?: number;
          vote_count?: number;
          status?: Database["public"]["Enums"]["continuation_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      continuation_boosts: {
        Row: {
          id: string;
          continuation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          continuation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          continuation_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      continuation_votes: {
        Row: {
          id: string;
          topic_id: string;
          continuation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          continuation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          continuation_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_supports: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          side: Database["public"]["Enums"]["vote_side"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          side: Database["public"]["Enums"]["vote_side"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          side?: Database["public"]["Enums"]["vote_side"];
          created_at?: string;
        };
        Relationships: [];
      };
      laws: {
        Row: {
          id: string;
          topic_id: string;
          statement: string;
          full_statement: string;
          body_markdown: string | null;
          category: string | null;
          established_at: string;
          is_active: boolean;
          blue_pct: number;
          total_votes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          statement: string;
          full_statement: string;
          body_markdown?: string | null;
          category?: string | null;
          established_at?: string;
          is_active?: boolean;
          blue_pct: number;
          total_votes: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          statement?: string;
          full_statement?: string;
          body_markdown?: string | null;
          category?: string | null;
          established_at?: string;
          is_active?: boolean;
          blue_pct?: number;
          total_votes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      law_links: {
        Row: {
          id: string;
          source_law_id: string;
          target_law_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_law_id: string;
          target_law_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_law_id?: string;
          target_law_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      law_revisions: {
        Row: {
          id: string;
          law_id: string;
          editor_id: string;
          body_markdown: string;
          summary: string | null;
          revision_num: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          law_id: string;
          editor_id: string;
          body_markdown: string;
          summary?: string | null;
          revision_num: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          law_id?: string;
          editor_id?: string;
          body_markdown?: string;
          summary?: string | null;
          revision_num?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      law_reopen_requests: {
        Row: {
          id: string;
          law_id: string;
          topic_id: string;
          requester_id: string;
          case_for_repeal: string;
          total_original_voters: number;
          consent_count: number;
          override_support_count: number;
          status: Database["public"]["Enums"]["reopen_status"];
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          law_id: string;
          topic_id: string;
          requester_id: string;
          case_for_repeal: string;
          total_original_voters: number;
          consent_count?: number;
          override_support_count?: number;
          status?: Database["public"]["Enums"]["reopen_status"];
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          law_id?: string;
          topic_id?: string;
          requester_id?: string;
          case_for_repeal?: string;
          total_original_voters?: number;
          consent_count?: number;
          override_support_count?: number;
          status?: Database["public"]["Enums"]["reopen_status"];
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      law_reopen_consents: {
        Row: {
          id: string;
          request_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "person" | "debator" | "troll_catcher" | "elder";
      topic_status:
        | "proposed"
        | "active"
        | "voting"
        | "continued"
        | "law"
        | "failed"
        | "archived";
      vote_side: "blue" | "red";
      continuation_status: "pending" | "finalist" | "winner" | "rejected";
      reopen_status: "pending" | "approved" | "rejected" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Topic = Database["public"]["Tables"]["topics"]["Row"];
export type TopicInsert = Database["public"]["Tables"]["topics"]["Insert"];
export type TopicUpdate = Database["public"]["Tables"]["topics"]["Update"];

export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type VoteInsert = Database["public"]["Tables"]["votes"]["Insert"];

export type TopicSupport = Database["public"]["Tables"]["topic_supports"]["Row"];

export type Law = Database["public"]["Tables"]["laws"]["Row"];
export type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export type LawLink = Database["public"]["Tables"]["law_links"]["Row"];

export type LawRevision = Database["public"]["Tables"]["law_revisions"]["Row"];

export type LawReopenRequest =
  Database["public"]["Tables"]["law_reopen_requests"]["Row"];

export type LawReopenConsent =
  Database["public"]["Tables"]["law_reopen_consents"]["Row"];

export type Continuation =
  Database["public"]["Tables"]["continuations"]["Row"];
export type ContinuationInsert =
  Database["public"]["Tables"]["continuations"]["Insert"];
export type ContinuationUpdate =
  Database["public"]["Tables"]["continuations"]["Update"];

export type ContinuationBoost =
  Database["public"]["Tables"]["continuation_boosts"]["Row"];
export type ContinuationBoostInsert =
  Database["public"]["Tables"]["continuation_boosts"]["Insert"];

export type ContinuationVote =
  Database["public"]["Tables"]["continuation_votes"]["Row"];
export type ContinuationVoteInsert =
  Database["public"]["Tables"]["continuation_votes"]["Insert"];

export type UserRole = Database["public"]["Enums"]["user_role"];
export type TopicStatus = Database["public"]["Enums"]["topic_status"];
export type VoteSide = Database["public"]["Enums"]["vote_side"];
export type ReopenStatus = Database["public"]["Enums"]["reopen_status"];
export type ContinuationStatus =
  Database["public"]["Enums"]["continuation_status"];

// Extended types with joined data
export type ContinuationWithAuthor = Continuation & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role"> | null;
};

export interface ChainNode {
  id: string;
  statement: string;
  connector: string | null;
  chain_depth: number;
  status: TopicStatus;
  blue_pct: number;
  total_votes: number;
  parent_id: string | null;
  is_current: boolean;
  winning_path: boolean;
}
