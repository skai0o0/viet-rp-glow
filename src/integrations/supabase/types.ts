export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowed_models: {
        Row: {
          id: string
          model_id: string
          model_name: string
          provider: string
          description: string
          is_free: boolean
          is_recommended: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          model_id: string
          model_name: string
          provider?: string
          description?: string
          is_free?: boolean
          is_recommended?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          model_name?: string
          provider?: string
          description?: string
          is_free?: boolean
          is_recommended?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          occasion: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          occasion?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          occasion?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          alternate_greetings: string[] | null
          avatar_url: string | null
          character_book: Json | null
          character_version: string
          created_at: string
          creator: string
          creator_notes: string
          description: string
          extensions: Json | null
          first_mes: string
          id: string
          is_public: boolean
          mes_example: string
          message_count: number
          name: string
          personality: string
          post_history_instructions: string
          rating: number
          scenario: string
          short_summary: string | null
          system_prompt: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alternate_greetings?: string[] | null
          avatar_url?: string | null
          character_book?: Json | null
          character_version?: string
          created_at?: string
          creator?: string
          creator_notes?: string
          description?: string
          extensions?: Json | null
          first_mes?: string
          id?: string
          is_public?: boolean
          mes_example?: string
          message_count?: number
          name: string
          personality?: string
          post_history_instructions?: string
          rating?: number
          scenario?: string
          short_summary?: string | null
          system_prompt?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alternate_greetings?: string[] | null
          avatar_url?: string | null
          character_book?: Json | null
          character_version?: string
          created_at?: string
          creator?: string
          creator_notes?: string
          description?: string
          extensions?: Json | null
          first_mes?: string
          id?: string
          is_public?: boolean
          mes_example?: string
          message_count?: number
          name?: string
          personality?: string
          post_history_instructions?: string
          rating?: number
          scenario?: string
          short_summary?: string | null
          system_prompt?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          character_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_ratings: {
        Row: {
          id: string
          user_id: string
          character_id: string
          value: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          character_id: string
          value: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          character_id?: string
          value?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_ratings_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          character_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          character_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          character_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          id: string
          title: string
          description: string
          content: string
          category: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          content: string
          category?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          content?: string
          category?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          nsfw_mode: boolean
          updated_at: string
          user_description: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          nsfw_mode?: boolean
          updated_at?: string
          user_description?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          nsfw_mode?: boolean
          updated_at?: string
          user_description?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          created_at: string
          description: string
          id: string
          phase: string
          phase_label: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          phase?: string
          phase_label?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          phase?: string
          phase_label?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_character_message_count: {
        Args: {
          char_id: string
        }
        Returns: undefined
      }
      increment_character_message_count_fallback: {
        Args: {
          char_id: string
        }
        Returns: undefined
      }
      decrement_character_message_count: {
        Args: {
          char_id: string
          amount: number
        }
        Returns: undefined
      }
      get_weekly_trending: {
        Args: {
          lim?: number
        }
        Returns: {
          character_id: string
          msg_count: number
        }[]
      }
      get_most_favorited: {
        Args: {
          lim?: number
        }
        Returns: {
          character_id: string
          fav_count: number
        }[]
      }
      exec_sql: {
        Args: {
          query: string
        }
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
