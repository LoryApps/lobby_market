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
          social_links: { twitter?: string; github?: string; website?: string } | null;
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
          onboarding_complete: boolean;
          category_preferences: string[];
          followers_count: number;
          following_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          social_links?: { twitter?: string; github?: string; website?: string } | null;
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
          onboarding_complete?: boolean;
          category_preferences?: string[];
          followers_count?: number;
          following_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          social_links?: { twitter?: string; github?: string; website?: string } | null;
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
          onboarding_complete?: boolean;
          category_preferences?: string[];
          followers_count?: number;
          following_count?: number;
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
          description: string | null;
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
          description_updated_at: string | null;
          description_updated_by: string | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          statement: string;
          description?: string | null;
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
          description_updated_at?: string | null;
          description_updated_by?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          statement?: string;
          description?: string | null;
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
          description_updated_at?: string | null;
          description_updated_by?: string | null;
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
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          side: Database["public"]["Enums"]["vote_side"];
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          side?: Database["public"]["Enums"]["vote_side"];
          reason?: string | null;
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
      topic_links: {
        Row: {
          id: string;
          source_topic_id: string;
          target_topic_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_topic_id: string;
          target_topic_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_topic_id?: string;
          target_topic_id?: string;
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
      lobbies: {
        Row: {
          id: string;
          topic_id: string;
          creator_id: string;
          name: string;
          position: Database["public"]["Enums"]["lobby_position"];
          campaign_statement: string;
          evidence_links: string[];
          coalition_id: string | null;
          member_count: number;
          influence_score: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          creator_id: string;
          name: string;
          position: Database["public"]["Enums"]["lobby_position"];
          campaign_statement: string;
          evidence_links?: string[];
          coalition_id?: string | null;
          member_count?: number;
          influence_score?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          creator_id?: string;
          name?: string;
          position?: Database["public"]["Enums"]["lobby_position"];
          campaign_statement?: string;
          evidence_links?: string[];
          coalition_id?: string | null;
          member_count?: number;
          influence_score?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lobby_members: {
        Row: {
          id: string;
          lobby_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      coalitions: {
        Row: {
          id: string;
          name: string;
          creator_id: string;
          description: string | null;
          member_count: number;
          coalition_influence: number;
          wins: number;
          losses: number;
          is_public: boolean;
          max_members: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          creator_id: string;
          description?: string | null;
          member_count?: number;
          coalition_influence?: number;
          wins?: number;
          losses?: number;
          is_public?: boolean;
          max_members?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          creator_id?: string;
          description?: string | null;
          member_count?: number;
          coalition_influence?: number;
          wins?: number;
          losses?: number;
          is_public?: boolean;
          max_members?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coalition_members: {
        Row: {
          id: string;
          coalition_id: string;
          user_id: string;
          role: "leader" | "officer" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          coalition_id: string;
          user_id: string;
          role?: "leader" | "officer" | "member";
          joined_at?: string;
        };
        Update: {
          id?: string;
          coalition_id?: string;
          user_id?: string;
          role?: "leader" | "officer" | "member";
          joined_at?: string;
        };
        Relationships: [];
      };
      coalition_invites: {
        Row: {
          id: string;
          coalition_id: string;
          inviter_id: string;
          invitee_id: string;
          status: "pending" | "accepted" | "declined";
          message: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          coalition_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: "pending" | "accepted" | "declined";
          message?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          coalition_id?: string;
          inviter_id?: string;
          invitee_id?: string;
          status?: "pending" | "accepted" | "declined";
          message?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      coalition_join_requests: {
        Row: {
          id: string;
          coalition_id: string;
          user_id: string;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          coalition_id: string;
          user_id: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          coalition_id?: string;
          user_id?: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      coalition_stances: {
        Row: {
          id: string;
          coalition_id: string;
          topic_id: string;
          stance: "for" | "against" | "neutral";
          statement: string | null;
          declared_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coalition_id: string;
          topic_id: string;
          stance: "for" | "against" | "neutral";
          statement?: string | null;
          declared_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coalition_id?: string;
          topic_id?: string;
          stance?: "for" | "against" | "neutral";
          statement?: string | null;
          declared_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coalition_posts: {
        Row: {
          id: string;
          coalition_id: string;
          author_id: string;
          content: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coalition_id: string;
          author_id: string;
          content: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coalition_id?: string;
          author_id?: string;
          content?: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clout_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["clout_transaction_type"];
          amount: number;
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["clout_transaction_type"];
          amount: number;
          reason: string;
          reference_id?: string | null;
          reference_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["clout_transaction_type"];
          amount?: number;
          reason?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string | null;
          reported_content_type:
            | "topic"
            | "message"
            | "argument"
            | "lobby"
            | "continuation";
          reported_content_id: string;
          reason: string;
          description: string | null;
          status: Database["public"]["Enums"]["report_status"];
          reviewer_id: string | null;
          action_taken:
            | Database["public"]["Enums"]["report_action"]
            | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id?: string | null;
          reported_content_type:
            | "topic"
            | "message"
            | "argument"
            | "lobby"
            | "continuation";
          reported_content_id: string;
          reason: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          reviewer_id?: string | null;
          action_taken?:
            | Database["public"]["Enums"]["report_action"]
            | null;
          resolution_note?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_user_id?: string | null;
          reported_content_type?:
            | "topic"
            | "message"
            | "argument"
            | "lobby"
            | "continuation";
          reported_content_id?: string;
          reason?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          reviewer_id?: string | null;
          action_taken?:
            | Database["public"]["Enums"]["report_action"]
            | null;
          resolution_note?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      troll_catcher_training: {
        Row: {
          id: string;
          user_id: string;
          cases_attempted: number;
          cases_correct: number;
          accuracy_pct: number;
          passed: boolean;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          cases_attempted?: number;
          cases_correct?: number;
          accuracy_pct?: number;
          passed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          cases_attempted?: number;
          cases_correct?: number;
          accuracy_pct?: number;
          passed?: boolean;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          reference_id: string | null;
          reference_type: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          icon: string;
          tier: AchievementTier;
          criteria: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description: string;
          icon: string;
          tier: AchievementTier;
          criteria?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string;
          icon?: string;
          tier?: AchievementTier;
          criteria?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          earned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_id?: string;
          earned_at?: string;
        };
        Relationships: [];
      };
      debates: {
        Row: {
          id: string;
          topic_id: string;
          creator_id: string;
          type: Database["public"]["Enums"]["debate_type"];
          status: Database["public"]["Enums"]["debate_status"];
          phase: Database["public"]["Enums"]["debate_phase"];
          title: string;
          description: string | null;
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          phase_ends_at: string | null;
          viewer_count: number;
          blue_sway: number;
          red_sway: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          creator_id: string;
          type: Database["public"]["Enums"]["debate_type"];
          status?: Database["public"]["Enums"]["debate_status"];
          phase?: Database["public"]["Enums"]["debate_phase"];
          title: string;
          description?: string | null;
          scheduled_at: string;
          started_at?: string | null;
          ended_at?: string | null;
          phase_ends_at?: string | null;
          viewer_count?: number;
          blue_sway?: number;
          red_sway?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          creator_id?: string;
          type?: Database["public"]["Enums"]["debate_type"];
          status?: Database["public"]["Enums"]["debate_status"];
          phase?: Database["public"]["Enums"]["debate_phase"];
          title?: string;
          description?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          phase_ends_at?: string | null;
          viewer_count?: number;
          blue_sway?: number;
          red_sway?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      debate_participants: {
        Row: {
          id: string;
          debate_id: string;
          user_id: string;
          side: Database["public"]["Enums"]["vote_side"];
          is_speaker: boolean;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          debate_id: string;
          user_id: string;
          side: Database["public"]["Enums"]["vote_side"];
          is_speaker?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          id?: string;
          debate_id?: string;
          user_id?: string;
          side?: Database["public"]["Enums"]["vote_side"];
          is_speaker?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Relationships: [];
      };
      debate_messages: {
        Row: {
          id: string;
          debate_id: string;
          user_id: string;
          content: string;
          side: Database["public"]["Enums"]["vote_side"] | null;
          is_argument: boolean;
          upvotes: number;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          debate_id: string;
          user_id: string;
          content: string;
          side?: Database["public"]["Enums"]["vote_side"] | null;
          is_argument?: boolean;
          upvotes?: number;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          debate_id?: string;
          user_id?: string;
          content?: string;
          side?: Database["public"]["Enums"]["vote_side"] | null;
          is_argument?: boolean;
          upvotes?: number;
          parent_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      argument_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          argument_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          argument_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          argument_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_reactions: {
        Row: {
          id: string;
          topic_id: string;
          user_id: string;
          reaction: "insightful" | "controversial" | "complex" | "surprising";
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          user_id: string;
          reaction: "insightful" | "controversial" | "complex" | "surprising";
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          user_id?: string;
          reaction?: "insightful" | "controversial" | "complex" | "surprising";
          created_at?: string;
        };
        Relationships: [];
      };
      debate_reactions: {
        Row: {
          id: string;
          debate_id: string;
          user_id: string;
          emoji: string;
          side: Database["public"]["Enums"]["vote_side"] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          debate_id: string;
          user_id: string;
          emoji: string;
          side?: Database["public"]["Enums"]["vote_side"] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          debate_id?: string;
          user_id?: string;
          emoji?: string;
          side?: Database["public"]["Enums"]["vote_side"] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      debate_sway_votes: {
        Row: {
          id: string;
          debate_id: string;
          user_id: string;
          checkpoint: number;
          side: Database["public"]["Enums"]["vote_side"];
          created_at: string;
        };
        Insert: {
          id?: string;
          debate_id: string;
          user_id: string;
          checkpoint: number;
          side: Database["public"]["Enums"]["vote_side"];
          created_at?: string;
        };
        Update: {
          id?: string;
          debate_id?: string;
          user_id?: string;
          checkpoint?: number;
          side?: Database["public"]["Enums"]["vote_side"];
          created_at?: string;
        };
        Relationships: [];
      };
      debate_rsvps: {
        Row: {
          id: string;
          debate_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          debate_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          debate_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_arguments: {
        Row: {
          id: string;
          topic_id: string;
          user_id: string;
          side: "blue" | "red";
          content: string;
          upvotes: number;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          user_id: string;
          side: "blue" | "red";
          content: string;
          upvotes?: number;
          source_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          user_id?: string;
          side?: "blue" | "red";
          content?: string;
          upvotes?: number;
          source_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      argument_replies: {
        Row: {
          id: string;
          argument_id: string;
          topic_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          argument_id: string;
          topic_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          argument_id?: string;
          topic_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_argument_votes: {
        Row: {
          argument_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          argument_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          argument_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      topic_bookmarks: {
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
      topic_subscriptions: {
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
      topic_predictions: {
        Row: {
          id: string;
          topic_id: string;
          user_id: string;
          predicted_law: boolean;
          confidence: number;
          reasoning: string | null;
          resolved_at: string | null;
          correct: boolean | null;
          brier_score: number | null;
          clout_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          user_id: string;
          predicted_law: boolean;
          confidence: number;
          reasoning?: string | null;
          resolved_at?: string | null;
          correct?: boolean | null;
          brier_score?: number | null;
          clout_earned?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          user_id?: string;
          predicted_law?: boolean;
          confidence?: number;
          reasoning?: string | null;
          resolved_at?: string | null;
          correct?: boolean | null;
          brier_score?: number | null;
          clout_earned?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      topic_prediction_stats: {
        Row: {
          topic_id: string;
          total_predictions: number;
          law_confidence: number;
          updated_at: string;
        };
        Insert: {
          topic_id: string;
          total_predictions?: number;
          law_confidence?: number;
          updated_at?: string;
        };
        Update: {
          topic_id?: string;
          total_predictions?: number;
          law_confidence?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_quorum_completions: {
        Row: {
          id: string;
          user_id: string;
          quorum_date: string;
          topic_ids: string[];
          clout_earned: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quorum_date?: string;
          topic_ids: string[];
          clout_earned?: number;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          quorum_date?: string;
          topic_ids?: string[];
          clout_earned?: number;
          completed_at?: string;
        };
        Relationships: [];
      };
      user_notification_prefs: {
        Row: {
          user_id: string;
          achievement_earned: boolean;
          debate_starting: boolean;
          law_established: boolean;
          topic_activated: boolean;
          vote_threshold: boolean;
          reply_received: boolean;
          role_promoted: boolean;
          lobby_update: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          achievement_earned?: boolean;
          debate_starting?: boolean;
          law_established?: boolean;
          topic_activated?: boolean;
          vote_threshold?: boolean;
          reply_received?: boolean;
          role_promoted?: boolean;
          lobby_update?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          achievement_earned?: boolean;
          debate_starting?: boolean;
          law_established?: boolean;
          topic_activated?: boolean;
          vote_threshold?: boolean;
          reply_received?: boolean;
          role_promoted?: boolean;
          lobby_update?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notification_prefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      topic_sources: {
        Row: {
          id: string;
          topic_id: string;
          added_by: string;
          url: string;
          title: string;
          description: string | null;
          domain: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          added_by: string;
          url: string;
          title: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          added_by?: string;
          url?: string;
          title?: string;
          description?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topic_sources_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_sources_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      topic_collections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          item_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          item_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_public?: boolean;
          item_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collection_items: {
        Row: {
          collection_id: string;
          topic_id: string;
          note: string | null;
          added_at: string;
        };
        Insert: {
          collection_id: string;
          topic_id: string;
          note?: string | null;
          added_at?: string;
        };
        Update: {
          collection_id?: string;
          topic_id?: string;
          note?: string | null;
          added_at?: string;
        };
        Relationships: [];
      };
      lobby_snapshots: {
        Row: {
          id: string;
          lobby_id: string;
          member_count: number;
          influence_score: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          lobby_id: string;
          member_count?: number;
          influence_score?: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          lobby_id?: string;
          member_count?: number;
          influence_score?: number;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lobby_snapshots_lobby_id_fkey";
            columns: ["lobby_id"];
            isOneToOne: false;
            referencedRelation: "lobbies";
            referencedColumns: ["id"];
          }
        ];
      };
      topic_ai_briefs: {
        Row: {
          id: string;
          topic_id: string;
          brief_text: string;
          argument_hash: string;
          model: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          brief_text: string;
          argument_hash: string;
          model?: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          brief_text?: string;
          argument_hash?: string;
          model?: string;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topic_ai_briefs_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: true;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          }
        ];
      };
      daily_editorials: {
        Row: {
          id: string;
          date_key: string;
          headline: string;
          lede: string;
          body: string;
          topics_json: unknown;
          model: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          date_key: string;
          headline: string;
          lede: string;
          body: string;
          topics_json?: unknown;
          model?: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          date_key?: string;
          headline?: string;
          lede?: string;
          body?: string;
          topics_json?: unknown;
          model?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      topic_bounties: {
        Row: {
          id: string;
          topic_id: string;
          creator_id: string;
          side: 'for' | 'against' | null;
          amount: number;
          description: string;
          deadline: string | null;
          winner_argument_id: string | null;
          winner_id: string | null;
          status: 'open' | 'awarded' | 'expired';
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          creator_id: string;
          side?: 'for' | 'against' | null;
          amount?: number;
          description: string;
          deadline?: string | null;
          winner_argument_id?: string | null;
          winner_id?: string | null;
          status?: 'open' | 'awarded' | 'expired';
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string;
          creator_id?: string;
          side?: 'for' | 'against' | null;
          amount?: number;
          description?: string;
          deadline?: string | null;
          winner_argument_id?: string | null;
          winner_id?: string | null;
          status?: 'open' | 'awarded' | 'expired';
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_topic_view: {
        Args: { topic_uuid: string };
        Returns: undefined;
      };
      refresh_topic_prediction_stats: {
        Args: { p_topic_id: string };
        Returns: undefined;
      };
      claim_daily_quorum: {
        Args: {
          p_user_id: string;
          p_topic_ids: string[];
          p_quorum_date?: string;
        };
        Returns: unknown;
      };
      gift_clout: {
        Args: {
          p_recipient_id: string;
          p_amount: number;
          p_reason?: string;
        };
        Returns: {
          status: string;
          new_balance?: number;
          balance?: number;
          recipient_username?: string;
        };
      };
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
      debate_type: "quick" | "grand" | "tribunal";
      debate_status: "scheduled" | "live" | "ended" | "cancelled";
      debate_phase:
        | "opening"
        | "cross_exam"
        | "closing"
        | "audience_qa"
        | "ended";
      lobby_position: "for" | "against";
      clout_transaction_type: "earned" | "spent" | "gifted" | "refunded";
      report_status:
        | "pending"
        | "reviewing"
        | "resolved"
        | "dismissed"
        | "escalated";
      report_action: "dismiss" | "warn" | "hide" | "escalate" | "ban";
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

// Topic with joined author profile (returned by the enriched feed API)
export type TopicAuthor = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "role"
>;
export type TopicWithAuthor = Topic & { author: TopicAuthor | null };

export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type VoteInsert = Database["public"]["Tables"]["votes"]["Insert"];

export type TopicSupport = Database["public"]["Tables"]["topic_supports"]["Row"];

export type Law = Database["public"]["Tables"]["laws"]["Row"];
export type LawInsert = Database["public"]["Tables"]["laws"]["Insert"];

export type LawLink = Database["public"]["Tables"]["law_links"]["Row"];
export type TopicLink = Database["public"]["Tables"]["topic_links"]["Row"];

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

// Notification, Achievement & UserAchievement types
export type NotificationType =
  | "topic_activated"
  | "vote_threshold"
  | "vote_started"
  | "law_established"
  | "debate_starting"
  | "achievement_earned"
  | "reply_received"
  | "lobby_update"
  | "role_promoted"
  | "coalition_invite"
  | "coalition_invite_accepted"
  | "bookmark_update"
  | "new_follower";

export type AchievementTier = "common" | "rare" | "epic" | "legendary";

export type Notification =
  Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];
export type NotificationUpdate =
  Database["public"]["Tables"]["notifications"]["Update"];

export type Achievement =
  Database["public"]["Tables"]["achievements"]["Row"];
export type AchievementInsert =
  Database["public"]["Tables"]["achievements"]["Insert"];
export type AchievementUpdate =
  Database["public"]["Tables"]["achievements"]["Update"];

export type UserAchievement =
  Database["public"]["Tables"]["user_achievements"]["Row"];
export type UserAchievementInsert =
  Database["public"]["Tables"]["user_achievements"]["Insert"];

// Extended joined types
export type UserAchievementWithAchievement = UserAchievement & {
  achievement: Achievement;
};

// Extended types with joined data
export type ContinuationWithAuthor = Continuation & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role"> | null;
};

// Debate types
export type Debate = Database["public"]["Tables"]["debates"]["Row"];
export type DebateInsert = Database["public"]["Tables"]["debates"]["Insert"];
export type DebateUpdate = Database["public"]["Tables"]["debates"]["Update"];

export type DebateParticipant =
  Database["public"]["Tables"]["debate_participants"]["Row"];
export type DebateParticipantInsert =
  Database["public"]["Tables"]["debate_participants"]["Insert"];

export type DebateMessage =
  Database["public"]["Tables"]["debate_messages"]["Row"];
export type DebateMessageInsert =
  Database["public"]["Tables"]["debate_messages"]["Insert"];

export type DebateReaction =
  Database["public"]["Tables"]["debate_reactions"]["Row"];
export type DebateReactionInsert =
  Database["public"]["Tables"]["debate_reactions"]["Insert"];

export type DebateSwayVote =
  Database["public"]["Tables"]["debate_sway_votes"]["Row"];
export type DebateSwayVoteInsert =
  Database["public"]["Tables"]["debate_sway_votes"]["Insert"];

export type DebateType = Database["public"]["Enums"]["debate_type"];
export type DebateStatus = Database["public"]["Enums"]["debate_status"];
export type DebatePhase = Database["public"]["Enums"]["debate_phase"];

// Extended debate types with joined data
export type DebateWithTopic = Debate & {
  topic: Pick<Topic, "id" | "statement" | "category"> | null;
  creator: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

export type DebateParticipantWithProfile = DebateParticipant & {
  profile: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

export type DebateMessageWithAuthor = DebateMessage & {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

// RSVP — spectator attendance for scheduled debates
export interface DebateRsvp {
  id: string;
  debate_id: string;
  user_id: string;
  created_at: string;
}

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

// -----------------------------------------------------------------------
// Phase 4: Lobbies, Clout economy, Troll Catcher moderation
// -----------------------------------------------------------------------

export type Lobby = Database["public"]["Tables"]["lobbies"]["Row"];
export type LobbyInsert = Database["public"]["Tables"]["lobbies"]["Insert"];
export type LobbyUpdate = Database["public"]["Tables"]["lobbies"]["Update"];

export type LobbyMember =
  Database["public"]["Tables"]["lobby_members"]["Row"];
export type LobbyMemberInsert =
  Database["public"]["Tables"]["lobby_members"]["Insert"];

export type Coalition = Database["public"]["Tables"]["coalitions"]["Row"];
export type CoalitionInsert =
  Database["public"]["Tables"]["coalitions"]["Insert"];
export type CoalitionUpdate =
  Database["public"]["Tables"]["coalitions"]["Update"];

export type CoalitionMember =
  Database["public"]["Tables"]["coalition_members"]["Row"];
export type CoalitionMemberInsert =
  Database["public"]["Tables"]["coalition_members"]["Insert"];

export type CoalitionInvite =
  Database["public"]["Tables"]["coalition_invites"]["Row"];
export type CoalitionInviteInsert =
  Database["public"]["Tables"]["coalition_invites"]["Insert"];

export type CoalitionJoinRequest =
  Database["public"]["Tables"]["coalition_join_requests"]["Row"];
export type CoalitionJoinRequestInsert =
  Database["public"]["Tables"]["coalition_join_requests"]["Insert"];

export type CloutTransaction =
  Database["public"]["Tables"]["clout_transactions"]["Row"];
export type CloutTransactionInsert =
  Database["public"]["Tables"]["clout_transactions"]["Insert"];

export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];
export type ReportUpdate = Database["public"]["Tables"]["reports"]["Update"];

export type TrollCatcherTraining =
  Database["public"]["Tables"]["troll_catcher_training"]["Row"];
export type TrollCatcherTrainingInsert =
  Database["public"]["Tables"]["troll_catcher_training"]["Insert"];
export type TrollCatcherTrainingUpdate =
  Database["public"]["Tables"]["troll_catcher_training"]["Update"];

export type LobbyPosition =
  Database["public"]["Enums"]["lobby_position"];
export type CloutTransactionType =
  Database["public"]["Enums"]["clout_transaction_type"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];
export type ReportAction = Database["public"]["Enums"]["report_action"];

// Extended joined types
export type LobbyWithCreator = Lobby & {
  creator: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

export type LobbyWithTopic = Lobby & {
  topic: Pick<Topic, "id" | "statement" | "category" | "status"> | null;
};

export type CloutTransactionWithUser = CloutTransaction & {
  user: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

export type ReportWithReporter = Report & {
  reporter: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

// User follows
export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Topic arguments
export interface TopicArgument {
  id: string;
  topic_id: string;
  user_id: string;
  side: "blue" | "red";
  content: string;
  upvotes: number;
  source_url: string | null;
  created_at: string;
}

export type TopicArgumentWithAuthor = TopicArgument & {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
  has_upvoted: boolean;
};

// Argument replies (threaded discussion beneath a single argument)
export interface ArgumentReply {
  id: string;
  argument_id: string;
  topic_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export type ArgumentReplyWithAuthor = ArgumentReply & {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

// Argument bookmark
export interface ArgumentBookmark {
  id: string;
  user_id: string;
  argument_id: string;
  created_at: string;
}

// Prediction market
export interface TopicPrediction {
  id: string;
  topic_id: string;
  user_id: string;
  predicted_law: boolean;
  confidence: number;
  resolved_at: string | null;
  correct: boolean | null;
  brier_score: number | null;
  clout_earned: number;
  created_at: string;
  updated_at: string;
}

export interface TopicPredictionStats {
  topic_id: string;
  total_predictions: number;
  law_confidence: number;
  updated_at: string;
}

// Coalition bulletin board
export type CoalitionPost =
  Database["public"]["Tables"]["coalition_posts"]["Row"];
export type CoalitionPostInsert =
  Database["public"]["Tables"]["coalition_posts"]["Insert"];

export type CoalitionPostWithAuthor = CoalitionPost & {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  > | null;
};

// Topic reactions
export type TopicReaction =
  Database["public"]["Tables"]["topic_reactions"]["Row"];
export type TopicReactionInsert =
  Database["public"]["Tables"]["topic_reactions"]["Insert"];
export type TopicReactionType = TopicReaction["reaction"];
