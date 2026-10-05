export type ActivityType = 'daily' | 'weekly_n' | 'deadline' | 'monthly'
export type TrackingMode = 'timer' | 'count' | 'checkbox'
export type LogEntryType = 'session' | 'postponed' | 'completed'
export type SessionSource = 'timer' | 'manual' | 'auto'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          timezone: string
          is_admin: boolean
          reminder_time: string | null
          slip_answer: Json | null
          onboarding_completed_at: string | null
          merged_guest_id: string | null
          checkins_opt_out: boolean
          checkin_token: string
          last_welcome_back_shown_at: string | null
          last_gap_started_at: string | null
          welcome_back_dismissed_until: string | null
          birthday: string | null
          focus_activity_id: string | null
          focus_week_start: string | null
          review_weekday: number
          review_hour: number
          review_minute: number
          reviews_opt_out: boolean
          locale?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          timezone?: string
          is_admin?: boolean
          reminder_time?: string | null
          slip_answer?: Json | null
          onboarding_completed_at?: string | null
          merged_guest_id?: string | null
          checkins_opt_out?: boolean
          checkin_token?: string
          last_welcome_back_shown_at?: string | null
          last_gap_started_at?: string | null
          welcome_back_dismissed_until?: string | null
          birthday?: string | null
          focus_activity_id?: string | null
          focus_week_start?: string | null
          review_weekday?: number
          review_hour?: number
          review_minute?: number
          reviews_opt_out?: boolean
          locale?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          timezone?: string
          is_admin?: boolean
          reminder_time?: string | null
          slip_answer?: Json | null
          onboarding_completed_at?: string | null
          merged_guest_id?: string | null
          checkins_opt_out?: boolean
          last_welcome_back_shown_at?: string | null
          last_gap_started_at?: string | null
          welcome_back_dismissed_until?: string | null
          birthday?: string | null
          focus_activity_id?: string | null
          focus_week_start?: string | null
          review_weekday?: number
          review_hour?: number
          review_minute?: number
          reviews_opt_out?: boolean
          locale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          type: ActivityType
          tracking_mode: TrackingMode
          target_value: number | null
          target_unit: string | null
          target_effective_from: string
          weekly_target: number | null
          deadline: string | null
          why_matters: string | null
          usually_when: string | null
          off_weekdays?: number[]
          micro_steps: unknown[]
          archived: boolean
          template_id?: string | null
          name_overridden?: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          type: ActivityType
          template_id?: string | null
          name_overridden?: boolean
          tracking_mode: TrackingMode
          target_value?: number | null
          target_unit?: string | null
          target_effective_from?: string
          weekly_target?: number | null
          deadline?: string | null
          why_matters?: string | null
          usually_when?: string | null
          off_weekdays?: number[]
          micro_steps?: unknown[]
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          emoji?: string
          type?: ActivityType
          tracking_mode?: TrackingMode
          target_value?: number | null
          target_unit?: string | null
          target_effective_from?: string
          weekly_target?: number | null
          deadline?: string | null
          why_matters?: string | null
          usually_when?: string | null
          off_weekdays?: number[]
          micro_steps?: unknown[]
          archived?: boolean
          template_id?: string | null
          name_overridden?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      activity_target_history: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          target_value: number | null
          target_unit: string | null
          weekly_target: number | null
          effective_from: string
          effective_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          target_value?: number | null
          target_unit?: string | null
          weekly_target?: number | null
          effective_from: string
          effective_until?: string | null
          created_at?: string
        }
        Update: {
          effective_until?: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          unit: string
          archived: boolean
          template_id?: string | null
          name_overridden?: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          unit: string
          archived?: boolean
          template_id?: string | null
          name_overridden?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          emoji?: string
          unit?: string
          archived?: boolean
          template_id?: string | null
          name_overridden?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      metric_entries: {
        Row: {
          id: string
          metric_id: string
          user_id: string
          date: string
          value: number
          secondary_value: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          metric_id: string
          user_id: string
          date: string
          value: number
          secondary_value?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          value?: number
          secondary_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      medicines: {
        Row: {
          id: string
          user_id: string
          name: string
          photo_path: string | null
          weekdays: number[]
          system: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          photo_path?: string | null
          weekdays?: number[]
          system?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          photo_path?: string | null
          weekdays?: number[]
          system?: string | null
          archived?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      medicine_times: {
        Row: {
          id: string
          medicine_id: string
          user_id: string
          hour: number
          minute: number
          meal: string | null
          created_at: string
        }
        Insert: {
          id?: string
          medicine_id: string
          user_id: string
          hour: number
          minute: number
          meal?: string | null
          created_at?: string
        }
        Update: {
          hour?: number
          minute?: number
          meal?: string | null
        }
        Relationships: []
      }
      medicine_doses: {
        Row: {
          id: string
          medicine_id: string
          user_id: string
          date: string
          hour: number
          minute: number
          taken_at: string
        }
        Insert: {
          id?: string
          medicine_id: string
          user_id: string
          date: string
          hour: number
          minute: number
          taken_at?: string
        }
        Update: {
          taken_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          id: string
          user_id: string
          text: string
          day: string
          hour: number | null
          minute: number | null
          remind_before: boolean
          kind: string
          every_year: boolean
          done_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          text: string
          day: string
          hour?: number | null
          minute?: number | null
          remind_before?: boolean
          kind?: string
          every_year?: boolean
          done_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          text?: string
          day?: string
          hour?: number | null
          minute?: number | null
          remind_before?: boolean
          kind?: string
          every_year?: boolean
          done_at?: string | null
        }
        Relationships: []
      }
      log_entries: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          type: LogEntryType
          source: SessionSource | null
          started_at: string | null
          duration_seconds: number | null
          date: string
          note: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          type: LogEntryType
          source?: SessionSource | null
          started_at?: string | null
          duration_seconds?: number | null
          date: string
          note?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          source?: SessionSource | null
          started_at?: string | null
          duration_seconds?: number | null
          date?: string
          note?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      activity_pauses: {
        Row: {
          id: string
          user_id: string
          activity_id: string
          paused_from: string
          paused_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_id: string
          paused_from: string
          paused_until?: string | null
          created_at?: string
        }
        Update: {
          paused_from?: string
          paused_until?: string | null
        }
        Relationships: []
      }
      rest_days: {
        Row: {
          id: string
          user_id: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          created_at?: string
        }
        Update: {
          date?: string
        }
        Relationships: []
      }
      fresh_starts: {
        Row: {
          id: string
          user_id: string
          started_on: string
          covers_from: string
          covers_to: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_on: string
          covers_from: string
          covers_to: string
          created_at?: string
        }
        Update: {
          started_on?: string
          covers_from?: string
          covers_to?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          id: string
          user_id: string
          week_start: string
          payload: Json
          emailed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          payload: Json
          emailed_at?: string | null
          created_at?: string
        }
        Update: {
          payload?: Json
          emailed_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          rating: number
          liked: string | null
          improve: string | null
          wish: string | null
          name: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          rating: number
          liked?: string | null
          improve?: string | null
          wish?: string | null
          name?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          rating?: number
          liked?: string | null
          improve?: string | null
          wish?: string | null
          name?: string | null
          email?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          id: string
          path: string
          title: string | null
          visitor_id: string
          user_id: string | null
          referrer: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          path: string
          title?: string | null
          visitor_id: string
          user_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          path?: string
          title?: string | null
          visitor_id?: string
          user_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      marketing_groups: {
        Row: {
          id: string
          name: string
          code: string
          install_goal: number
          install_rate_rupees: number
          retained_rate_rupees: number
          cap_rupees: number | null
          min_payout_installs: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code?: string
          install_goal?: number
          install_rate_rupees?: number
          retained_rate_rupees?: number
          cap_rupees?: number | null
          min_payout_installs?: number
          created_at?: string
        }
        Update: {
          name?: string
          code?: string
          install_goal?: number
          install_rate_rupees?: number
          retained_rate_rupees?: number
          cap_rupees?: number | null
          min_payout_installs?: number
        }
        Relationships: []
      }
      marketing_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          email: string
          code: string
          removed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          email: string
          code?: string
          removed_at?: string | null
          created_at?: string
        }
        Update: {
          email?: string
          removed_at?: string | null
        }
        Relationships: []
      }
      marketing_payments: {
        Row: {
          id: string
          group_id: string
          member_id: string | null
          paid_on: string
          amount_rupees: number
          note: string
          paid: boolean
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          member_id?: string | null
          paid_on?: string
          amount_rupees: number
          note?: string
          paid?: boolean
          created_at?: string
        }
        Update: {
          paid?: boolean
          note?: string
          amount_rupees?: number
          paid_on?: string
          member_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          anon_id: string
          name: string
          props: Json
          path: string | null
          app_version: string | null
          platform: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          anon_id: string
          name: string
          props?: Json
          path?: string | null
          app_version?: string | null
          platform?: string | null
        }
        Update: {
          user_id?: string | null
          anon_id?: string
          name?: string
          props?: Json
          path?: string | null
          app_version?: string | null
          platform?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_current_user_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      list_signed_in_emails: {
        Args: Record<string, never>
        Returns: {
          email: string
          last_sign_in_at: string | null
          created_at: string
          activity_count: number
          metric_count: number
        }[]
      }
      merge_guest_draft: {
        Args: { payload: Json }
        Returns: Json
      }
      due_checkins: {
        Args: { p_now?: string }
        Returns: {
          user_id: string
          email: string
          day_n: number
          timezone: string
          checkin_token: string
        }[]
      }
      due_birthday_emails: {
        Args: { p_now?: string }
        Returns: {
          user_id: string
          email: string
          timezone: string
          local_date: string
          checkin_token: string
        }[]
      }
      opt_out_checkins: {
        Args: { p_token: string }
        Returns: boolean
      }
      mark_checkin_opened: {
        Args: Record<string, never>
        Returns: number
      }
      product_analytics_summary: {
        Args: { p_days: number }
        Returns: {
          signups: number
          d1_retention: number | null
          d7_retention: number | null
          logs_per_active_user: number | null
          comeback_count: number
          active_users: number
          log_events: number
        }[]
      }
      marketing_record_open: {
        Args: {
          p_device_key: string
          p_group_code: string
          p_member_code: string
          p_opened_on: string
        }
        Returns: undefined
      }
      marketing_add_member: {
        Args: { p_group_id: string; p_email: string }
        Returns: string
      }
      marketing_my_stats: {
        Args: { p_as_of: string }
        Returns: {
          group_id: string
          group_name: string
          group_code: string
          member_code: string
          install_goal: number
          install_rate_rupees: number
          retained_rate_rupees: number
          cap_rupees: number | null
          min_payout_installs: number
          group_installs: number
          group_in_progress: number
          group_retained: number
          group_ended_short: number
          my_installs: number
          my_in_progress: number
          my_retained: number
          my_ended_short: number
        }[]
      }
      marketing_admin_counts: {
        Args: { p_as_of: string }
        Returns: {
          group_id: string
          member_id: string | null
          installs: number
          in_progress: number
          retained: number
          ended_short: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
