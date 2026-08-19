export type ActivityType = 'daily' | 'weekly_n' | 'deadline' | 'monthly'
export type TrackingMode = 'timer' | 'count' | 'checkbox'
export type LogEntryType = 'session' | 'postponed' | 'completed'
export type SessionSource = 'timer' | 'manual'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          timezone: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          timezone?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          timezone?: string
          is_admin?: boolean
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
          micro_steps: unknown[]
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          type: ActivityType
          tracking_mode: TrackingMode
          target_value?: number | null
          target_unit?: string | null
          target_effective_from?: string
          weekly_target?: number | null
          deadline?: string | null
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
          micro_steps?: unknown[]
          archived?: boolean
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          emoji?: string
          unit?: string
          archived?: boolean
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          metric_id: string
          user_id: string
          date: string
          value: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          value?: number
          updated_at?: string
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
