export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_resource: string
          timestamp: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_resource: string
          timestamp?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_resource?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          bg_gradient: string
          created_at: string
          description: string | null
          display_order: number
          features: Json
          icon_image_path: string | null
          icon_name: string
          id: string
          image_path: string | null
          is_active: boolean
          link_path: string
          name: string
          required_plan: string
          updated_at: string
        }
        Insert: {
          bg_gradient?: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json
          icon_image_path?: string | null
          icon_name?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_path: string
          name: string
          required_plan?: string
          updated_at?: string
        }
        Update: {
          bg_gradient?: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json
          icon_image_path?: string | null
          icon_name?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_path?: string
          name?: string
          required_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_prompts: {
        Row: {
          added_at: string | null
          collection_id: string
          prompt_id: string
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          prompt_id: string
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          prompt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_prompts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_prompts_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      discount_code_usage: {
        Row: {
          discount_code_id: string
          id: string
          payment_history_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          discount_code_id: string
          id?: string
          payment_history_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          discount_code_id?: string
          id?: string
          payment_history_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_plans: Json | null
          applies_to_all_plans: boolean | null
          code: string
          created_at: string
          created_by: string
          discount_type: string
          discount_value: number
          expiration_date: string | null
          id: string
          is_active: boolean
          times_used: number
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          applicable_plans?: Json | null
          applies_to_all_plans?: boolean | null
          code: string
          created_at?: string
          created_by: string
          discount_type: string
          discount_value: number
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          applicable_plans?: Json | null
          applies_to_all_plans?: boolean | null
          code?: string
          created_at?: string
          created_by?: string
          discount_type?: string
          discount_value?: number
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempted_at: string | null
          created_at: string | null
          email_address: string
          email_type: string
          error_message: string | null
          id: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          created_at?: string | null
          email_address: string
          email_type: string
          error_message?: string | null
          id?: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          created_at?: string | null
          email_address?: string
          email_type?: string
          error_message?: string | null
          id?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          prompt_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          prompt_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          membership_tier: string | null
          phone_number: string | null
          role: string
          social_links: Json | null
          timezone: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          first_name: string
          id: string
          last_name: string
          membership_tier?: string | null
          phone_number?: string | null
          role?: string
          social_links?: Json | null
          timezone?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          membership_tier?: string | null
          phone_number?: string | null
          role?: string
          social_links?: Json | null
          timezone?: string | null
          username?: string
        }
        Relationships: []
      }
      prompt_shares: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          prompt_id: string | null
          shared_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          prompt_id?: string | null
          shared_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          prompt_id?: string | null
          shared_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_shares_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_usage_history: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          prompt_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prompt_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prompt_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_usage_history_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string | null
          default_image_path: string | null
          id: string
          image_path: string | null
          metadata: Json | null
          prompt_text: string
          prompt_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_image_path?: string | null
          id?: string
          image_path?: string | null
          metadata?: Json | null
          prompt_text: string
          prompt_type?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_image_path?: string | null
          id?: string
          image_path?: string | null
          metadata?: Json | null
          prompt_text?: string
          prompt_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_prompts_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          duration_days: number | null
          excluded_features: Json
          features: Json
          id: string
          is_lifetime: boolean
          name: string
          price_usd: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          excluded_features?: Json
          features?: Json
          id?: string
          is_lifetime?: boolean
          name: string
          price_usd: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          excluded_features?: Json
          features?: Json
          id?: string
          is_lifetime?: boolean
          name?: string
          price_usd?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_usd: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          is_upgrade: boolean | null
          paypal_order_id: string | null
          paypal_payment_id: string | null
          plan_id: string
          status: string
          upgrade_from_plan_id: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_upgrade?: boolean | null
          paypal_order_id?: string | null
          paypal_payment_id?: string | null
          plan_id: string
          status?: string
          upgrade_from_plan_id?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_upgrade?: boolean | null
          paypal_order_id?: string | null
          paypal_payment_id?: string | null
          plan_id?: string
          status?: string
          upgrade_from_plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_upgrade_from_plan_id_fkey"
            columns: ["upgrade_from_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          payment_id: string | null
          payment_method: string
          plan_id: string
          start_date: string
          status: string
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          payment_id?: string | null
          payment_method: string
          plan_id: string
          start_date?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          payment_id?: string | null
          payment_method?: string
          plan_id?: string
          start_date?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_prompts: {
        Args: { _user_id: string }
        Returns: boolean
      }
      cancel_user_subscription: {
        Args: { _user_id: string; _admin_id: string }
        Returns: Json
      }
      create_subscription: {
        Args: {
          p_user_id: string
          p_plan_id: string
          p_paypal_payment_id: string
        }
        Returns: Json
      }
      delete_user_account: {
        Args: { _user_id: string }
        Returns: Json
      }
      has_role: {
        Args: { _user_id: string; _role: string }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      record_discount_usage: {
        Args: {
          discount_code_id_param: string
          user_id_param?: string
          payment_history_id_param?: string
        }
        Returns: boolean
      }
      validate_discount_code: {
        Args:
          | { code_text: string; plan_id_param?: string }
          | {
              code_text: string
              plan_id_param?: string
              user_id_param?: string
            }
        Returns: {
          id: string
          discount_type: string
          discount_value: number
          is_valid: boolean
          error_message: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
