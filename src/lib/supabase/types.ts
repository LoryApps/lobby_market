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
          feed_score?: number;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
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

export type UserRole = Database["public"]["Enums"]["user_role"];
export type TopicStatus = Database["public"]["Enums"]["topic_status"];
export type VoteSide = Database["public"]["Enums"]["vote_side"];
