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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_evaluations: {
        Row: {
          action: string
          context_data: Json | null
          created_at: string | null
          decision: string
          evaluation_factors: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          risk_score: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          context_data?: Json | null
          created_at?: string | null
          decision: string
          evaluation_factors?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          context_data?: Json | null
          created_at?: string | null
          decision?: string
          evaluation_factors?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_access_tokens: {
        Row: {
          admin_user_id: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_valid: boolean | null
          metadata: Json | null
          operation_type: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          metadata?: Json | null
          operation_type: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          metadata?: Json | null
          operation_type?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
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
      admin_ip_restrictions: {
        Row: {
          admin_user_id: string
          allowed_ip_ranges: string[]
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          restriction_type: string
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          allowed_ip_ranges: string[]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          restriction_type?: string
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          allowed_ip_ranges?: string[]
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          restriction_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          is_suspicious: boolean | null
          metadata: Json | null
          method: string
          request_signature: string | null
          response_status: number | null
          response_time_ms: number | null
          risk_score: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          metadata?: Json | null
          method: string
          request_signature?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          metadata?: Json | null
          method?: string
          request_signature?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      apple_email_logs: {
        Row: {
          created_at: string
          email: string
          email_type: string
          error_message: string | null
          id: string
          status: string
          timestamp: string
        }
        Insert: {
          created_at?: string
          email: string
          email_type: string
          error_message?: string | null
          id?: string
          status: string
          timestamp?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_type?: string
          error_message?: string | null
          id?: string
          status?: string
          timestamp?: string
        }
        Relationships: []
      }
      automated_responses: {
        Row: {
          action_parameters: Json | null
          action_type: string
          condition_rules: Json
          created_at: string | null
          created_by: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed: string | null
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          action_parameters?: Json | null
          action_type: string
          condition_rules: Json
          created_at?: string | null
          created_by?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed?: string | null
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          action_parameters?: Json | null
          action_type?: string
          condition_rules?: Json
          created_at?: string | null
          created_by?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed?: string | null
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_recovery_logs: {
        Row: {
          automated: boolean | null
          backup_location: string | null
          backup_type: string
          compression_ratio: number | null
          created_at: string | null
          data_size_bytes: number | null
          data_sources: Json | null
          duration_seconds: number | null
          encryption_status: string | null
          end_time: string | null
          error_details: Json | null
          expiry_date: string | null
          id: string
          initiated_by: string | null
          operation_status: string | null
          operation_type: string
          recovery_point_objective_met: boolean | null
          recovery_time_objective_met: boolean | null
          retention_policy: string | null
          start_time: string
          verification_results: Json | null
          verification_status: string | null
        }
        Insert: {
          automated?: boolean | null
          backup_location?: string | null
          backup_type: string
          compression_ratio?: number | null
          created_at?: string | null
          data_size_bytes?: number | null
          data_sources?: Json | null
          duration_seconds?: number | null
          encryption_status?: string | null
          end_time?: string | null
          error_details?: Json | null
          expiry_date?: string | null
          id?: string
          initiated_by?: string | null
          operation_status?: string | null
          operation_type: string
          recovery_point_objective_met?: boolean | null
          recovery_time_objective_met?: boolean | null
          retention_policy?: string | null
          start_time?: string
          verification_results?: Json | null
          verification_status?: string | null
        }
        Update: {
          automated?: boolean | null
          backup_location?: string | null
          backup_type?: string
          compression_ratio?: number | null
          created_at?: string | null
          data_size_bytes?: number | null
          data_sources?: Json | null
          duration_seconds?: number | null
          encryption_status?: string | null
          end_time?: string | null
          error_details?: Json | null
          expiry_date?: string | null
          id?: string
          initiated_by?: string | null
          operation_status?: string | null
          operation_type?: string
          recovery_point_objective_met?: boolean | null
          recovery_time_objective_met?: boolean | null
          retention_policy?: string | null
          start_time?: string
          verification_results?: Json | null
          verification_status?: string | null
        }
        Relationships: []
      }
      behavioral_anomalies: {
        Row: {
          anomaly_details: Json
          anomaly_type: string
          baseline_deviation: number | null
          created_at: string | null
          detection_algorithm: string
          false_positive: boolean | null
          id: string
          investigated_at: string | null
          investigated_by: string | null
          is_confirmed: boolean | null
          severity_score: number
          user_id: string | null
        }
        Insert: {
          anomaly_details: Json
          anomaly_type: string
          baseline_deviation?: number | null
          created_at?: string | null
          detection_algorithm: string
          false_positive?: boolean | null
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          is_confirmed?: boolean | null
          severity_score: number
          user_id?: string | null
        }
        Update: {
          anomaly_details?: Json
          anomaly_type?: string
          baseline_deviation?: number | null
          created_at?: string | null
          detection_algorithm?: string
          false_positive?: boolean | null
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          is_confirmed?: boolean | null
          severity_score?: number
          user_id?: string | null
        }
        Relationships: []
      }
      business_continuity_plans: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          effectiveness_score: number | null
          id: string
          is_active: boolean | null
          last_tested: string | null
          plan_name: string
          plan_type: string
          procedures: Json | null
          recovery_objectives: Json | null
          resource_requirements: Json | null
          scope_description: string | null
          test_results: Json | null
          testing_schedule: Json | null
          updated_at: string | null
          version_number: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          effectiveness_score?: number | null
          id?: string
          is_active?: boolean | null
          last_tested?: string | null
          plan_name: string
          plan_type: string
          procedures?: Json | null
          recovery_objectives?: Json | null
          resource_requirements?: Json | null
          scope_description?: string | null
          test_results?: Json | null
          testing_schedule?: Json | null
          updated_at?: string | null
          version_number?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          effectiveness_score?: number | null
          id?: string
          is_active?: boolean | null
          last_tested?: string | null
          plan_name?: string
          plan_type?: string
          procedures?: Json | null
          recovery_objectives?: Json | null
          resource_requirements?: Json | null
          scope_description?: string | null
          test_results?: Json | null
          testing_schedule?: Json | null
          updated_at?: string | null
          version_number?: string | null
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
      compliance_audits: {
        Row: {
          audit_date: string
          audit_scope: Json | null
          audit_type: string
          auditor_id: string | null
          completion_date: string | null
          compliance_framework: string
          compliance_score: number | null
          created_at: string | null
          findings: Json | null
          id: string
          next_audit_date: string | null
          recommendations: Json | null
          risk_score: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          audit_date?: string
          audit_scope?: Json | null
          audit_type: string
          auditor_id?: string | null
          completion_date?: string | null
          compliance_framework: string
          compliance_score?: number | null
          created_at?: string | null
          findings?: Json | null
          id?: string
          next_audit_date?: string | null
          recommendations?: Json | null
          risk_score?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          audit_date?: string
          audit_scope?: Json | null
          audit_type?: string
          auditor_id?: string | null
          completion_date?: string | null
          compliance_framework?: string
          compliance_score?: number | null
          created_at?: string | null
          findings?: Json | null
          id?: string
          next_audit_date?: string | null
          recommendations?: Json | null
          risk_score?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_controls: {
        Row: {
          control_category: string
          control_id: string
          control_name: string
          created_at: string | null
          description: string | null
          effectiveness_rating: number | null
          evidence_artifacts: Json | null
          exceptions: Json | null
          framework: string
          id: string
          implementation_details: Json | null
          implementation_status: string | null
          last_tested: string | null
          next_review_date: string | null
          owner_id: string | null
          remediation_plan: Json | null
          reviewer_id: string | null
          risk_rating: string | null
          test_results: Json | null
          testing_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          control_category: string
          control_id: string
          control_name: string
          created_at?: string | null
          description?: string | null
          effectiveness_rating?: number | null
          evidence_artifacts?: Json | null
          exceptions?: Json | null
          framework: string
          id?: string
          implementation_details?: Json | null
          implementation_status?: string | null
          last_tested?: string | null
          next_review_date?: string | null
          owner_id?: string | null
          remediation_plan?: Json | null
          reviewer_id?: string | null
          risk_rating?: string | null
          test_results?: Json | null
          testing_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          control_category?: string
          control_id?: string
          control_name?: string
          created_at?: string | null
          description?: string | null
          effectiveness_rating?: number | null
          evidence_artifacts?: Json | null
          exceptions?: Json | null
          framework?: string
          id?: string
          implementation_details?: Json | null
          implementation_status?: string | null
          last_tested?: string | null
          next_review_date?: string | null
          owner_id?: string | null
          remediation_plan?: Json | null
          reviewer_id?: string | null
          risk_rating?: string | null
          test_results?: Json | null
          testing_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      data_classification_metadata: {
        Row: {
          access_roles: string[] | null
          classification: Database["public"]["Enums"]["data_classification"]
          column_name: string
          created_at: string | null
          encryption_required: boolean | null
          id: string
          retention_days: number | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          access_roles?: string[] | null
          classification?: Database["public"]["Enums"]["data_classification"]
          column_name: string
          created_at?: string | null
          encryption_required?: boolean | null
          id?: string
          retention_days?: number | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          access_roles?: string[] | null
          classification?: Database["public"]["Enums"]["data_classification"]
          column_name?: string
          created_at?: string | null
          encryption_required?: boolean | null
          id?: string
          retention_days?: number | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          created_at: string | null
          created_by: string | null
          deletion_criteria: Json | null
          id: string
          is_active: boolean | null
          last_cleanup_at: string | null
          retention_days: number
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deletion_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          last_cleanup_at?: string | null
          retention_days: number
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deletion_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          last_cleanup_at?: string | null
          retention_days?: number
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      database_activity_log: {
        Row: {
          affected_rows: number | null
          created_at: string | null
          execution_time_ms: number | null
          id: string
          ip_address: string | null
          is_suspicious: boolean | null
          metadata: Json | null
          operation: string
          query_hash: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          affected_rows?: number | null
          created_at?: string | null
          execution_time_ms?: number | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          metadata?: Json | null
          operation: string
          query_hash?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          affected_rows?: number | null
          created_at?: string | null
          execution_time_ms?: number | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          metadata?: Json | null
          operation?: string
          query_hash?: string | null
          table_name?: string
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
      email_engagement: {
        Row: {
          created_at: string | null
          domain: string
          email_address: string
          email_opened: boolean | null
          id: string
          link_clicked: boolean | null
          marked_as_spam: boolean | null
          timestamp: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          email_address: string
          email_opened?: boolean | null
          id?: string
          link_clicked?: boolean | null
          marked_as_spam?: boolean | null
          timestamp?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          email_address?: string
          email_opened?: boolean | null
          id?: string
          link_clicked?: boolean | null
          marked_as_spam?: boolean | null
          timestamp?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempted_at: string | null
          bounce_reason: string | null
          created_at: string | null
          delivery_status: string | null
          domain_type: string | null
          email_address: string
          email_type: string
          error_message: string | null
          id: string
          response_metadata: Json | null
          retry_count: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          bounce_reason?: string | null
          created_at?: string | null
          delivery_status?: string | null
          domain_type?: string | null
          email_address: string
          email_type: string
          error_message?: string | null
          id?: string
          response_metadata?: Json | null
          retry_count?: number | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          bounce_reason?: string | null
          created_at?: string | null
          delivery_status?: string | null
          domain_type?: string | null
          email_address?: string
          email_type?: string
          error_message?: string | null
          id?: string
          response_metadata?: Json | null
          retry_count?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      email_magic_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          metadata: Json | null
          token: string
          token_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          metadata?: Json | null
          token: string
          token_type?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          token?: string
          token_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          html: string
          id: string
          is_active: boolean
          locale: string
          name: string
          slug: string
          subject: string
          text: string | null
          type: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html: string
          id?: string
          is_active?: boolean
          locale?: string
          name: string
          slug: string
          subject: string
          text?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html?: string
          id?: string
          is_active?: boolean
          locale?: string
          name?: string
          slug?: string
          subject?: string
          text?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
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
      ml_models: {
        Row: {
          accuracy_score: number | null
          algorithm: string
          configuration: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          last_trained: string | null
          model_name: string
          model_type: string
          training_data_period: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_score?: number | null
          algorithm: string
          configuration: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_trained?: string | null
          model_name: string
          model_type: string
          training_data_period?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_score?: number | null
          algorithm?: string
          configuration?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_trained?: string | null
          model_name?: string
          model_type?: string
          training_data_period?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      prompt_generator_fields: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_order: number | null
          field_category: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          options: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          field_category: string
          field_name: string
          field_type: string
          id?: string
          is_active?: boolean | null
          options?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          field_category?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          options?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generator_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_generator_models: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          parameters: Json
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parameters?: Json
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parameters?: Json
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generator_models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_generator_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          model_type: string
          name: string
          template_data: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          model_type: string
          name: string
          template_data: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          model_type?: string
          name?: string
          template_data?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_generator_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_patterns: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          is_blocked: boolean | null
          max_requests: number
          pattern_type: string
          requests_count: number | null
          updated_at: string | null
          violation_count: number | null
          window_duration_seconds: number
          window_start: string | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          is_blocked?: boolean | null
          max_requests: number
          pattern_type: string
          requests_count?: number | null
          updated_at?: string | null
          violation_count?: number | null
          window_duration_seconds: number
          window_start?: string | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          is_blocked?: boolean | null
          max_requests?: number
          pattern_type?: string
          requests_count?: number | null
          updated_at?: string | null
          violation_count?: number | null
          window_duration_seconds?: number
          window_start?: string | null
        }
        Relationships: []
      }
      response_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          execution_status: string
          execution_time_ms: number | null
          id: string
          incident_id: string | null
          response_id: string | null
          result_details: Json | null
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          execution_status?: string
          execution_time_ms?: number | null
          id?: string
          incident_id?: string | null
          response_id?: string | null
          result_details?: Json | null
          triggered_by: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          execution_status?: string
          execution_time_ms?: number | null
          id?: string
          incident_id?: string | null
          response_id?: string | null
          result_details?: Json | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_executions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_executions_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "automated_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      security_assessments: {
        Row: {
          assessment_scope: Json | null
          assessment_type: string
          completed_at: string | null
          compliance_impact: Json | null
          conducted_by: string | null
          created_at: string | null
          id: string
          next_assessment_date: string | null
          remediation_plan: Json | null
          risk_matrix: Json | null
          scheduled_date: string | null
          severity_distribution: Json | null
          started_at: string | null
          status: string
          target_system: string
          updated_at: string | null
          vulnerabilities: Json | null
        }
        Insert: {
          assessment_scope?: Json | null
          assessment_type: string
          completed_at?: string | null
          compliance_impact?: Json | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          next_assessment_date?: string | null
          remediation_plan?: Json | null
          risk_matrix?: Json | null
          scheduled_date?: string | null
          severity_distribution?: Json | null
          started_at?: string | null
          status?: string
          target_system: string
          updated_at?: string | null
          vulnerabilities?: Json | null
        }
        Update: {
          assessment_scope?: Json | null
          assessment_type?: string
          completed_at?: string | null
          compliance_impact?: Json | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          next_assessment_date?: string | null
          remediation_plan?: Json | null
          risk_matrix?: Json | null
          scheduled_date?: string | null
          severity_distribution?: Json | null
          started_at?: string | null
          status?: string
          target_system?: string
          updated_at?: string | null
          vulnerabilities?: Json | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          affected_resources: Json | null
          affected_users: Json | null
          assigned_to: string | null
          containment_actions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          evidence: Json | null
          id: string
          incident_type: string
          resolved_at: string | null
          severity: string
          status: string
          timeline: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          affected_resources?: Json | null
          affected_users?: Json | null
          assigned_to?: string | null
          containment_actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence?: Json | null
          id?: string
          incident_type: string
          resolved_at?: string | null
          severity: string
          status?: string
          timeline?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          affected_resources?: Json | null
          affected_users?: Json | null
          assigned_to?: string | null
          containment_actions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence?: Json | null
          id?: string
          incident_type?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          timeline?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          event_category: string | null
          id: string
          ip_address: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          event_category?: string | null
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          event_category?: string | null
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_monitoring_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          ip_address: string | null
          is_resolved: boolean | null
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          title: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          is_resolved?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source: string
          title: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          is_resolved?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          title?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_training_records: {
        Row: {
          assessment_results: Json | null
          certificate_data: Json | null
          certificate_issued: boolean | null
          completion_date: string | null
          completion_status: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          next_training_date: string | null
          refresher_required: boolean | null
          score: number | null
          start_date: string | null
          training_category: string
          training_module: string
          training_provider: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assessment_results?: Json | null
          certificate_data?: Json | null
          certificate_issued?: boolean | null
          completion_date?: string | null
          completion_status?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          next_training_date?: string | null
          refresher_required?: boolean | null
          score?: number | null
          start_date?: string | null
          training_category: string
          training_module: string
          training_provider?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assessment_results?: Json | null
          certificate_data?: Json | null
          certificate_issued?: boolean | null
          completion_date?: string | null
          completion_status?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          next_training_date?: string | null
          refresher_required?: boolean | null
          score?: number | null
          start_date?: string | null
          training_category?: string
          training_module?: string
          training_provider?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_integrity: {
        Row: {
          created_at: string | null
          fingerprint_hash: string
          id: string
          ip_address: string | null
          is_valid: boolean | null
          last_activity: string | null
          session_token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fingerprint_hash: string
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          last_activity?: string | null
          session_token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fingerprint_hash?: string
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          last_activity?: string | null
          session_token_hash?: string
          user_agent?: string | null
          user_id?: string
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
      threat_indicators: {
        Row: {
          confidence: number | null
          created_at: string | null
          description: string | null
          first_seen: string | null
          id: string
          indicator_type: string
          indicator_value: string
          is_active: boolean | null
          last_seen: string | null
          metadata: Json | null
          severity: string
          source: string
          threat_type: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          first_seen?: string | null
          id?: string
          indicator_type: string
          indicator_value: string
          is_active?: boolean | null
          last_seen?: string | null
          metadata?: Json | null
          severity: string
          source: string
          threat_type: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          first_seen?: string | null
          id?: string
          indicator_type?: string
          indicator_value?: string
          is_active?: boolean | null
          last_seen?: string | null
          metadata?: Json | null
          severity?: string
          source?: string
          threat_type?: string
          updated_at?: string | null
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
      unsubscribe_rate_limits: {
        Row: {
          attempts: number | null
          blocked_until: string | null
          created_at: string | null
          email: string
          id: string
          ip_address: string
          window_start: string | null
        }
        Insert: {
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email: string
          id?: string
          ip_address: string
          window_start?: string | null
        }
        Update: {
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string
          window_start?: string | null
        }
        Relationships: []
      }
      unsubscribed_emails: {
        Row: {
          email: string
          id: string
          resubscribed_at: string | null
          unsubscribe_type: string
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          resubscribed_at?: string | null
          unsubscribe_type?: string
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          resubscribed_at?: string | null
          unsubscribe_type?: string
          unsubscribed_at?: string
        }
        Relationships: []
      }
      user_behavior_baselines: {
        Row: {
          baseline_data: Json
          confidence_score: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          metric_type: string
          user_id: string
        }
        Insert: {
          baseline_data: Json
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          metric_type: string
          user_id: string
        }
        Update: {
          baseline_data?: Json
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          metric_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_privacy_consent: {
        Row: {
          consent_given: boolean
          consent_type: string
          consent_version: string
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consent_given?: boolean
          consent_type: string
          consent_version?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_type?: string
          consent_version?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expires_at: string
          fingerprint_hash: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity: string | null
          location_data: Json | null
          risk_score: number | null
          session_token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expires_at: string
          fingerprint_hash: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          location_data?: Json | null
          risk_score?: number | null
          session_token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string
          fingerprint_hash?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          location_data?: Json | null
          risk_score?: number | null
          session_token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      admin_delete_user_data: {
        Args: { target_user_id: string }
        Returns: Json
      }
      calculate_anomaly_score: {
        Args: { p_current_data: Json; p_metric_type: string; p_user_id: string }
        Returns: number
      }
      can_access_sensitive_profile_data: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
      can_manage_prompts: {
        Args: { _user_id: string }
        Returns: boolean
      }
      cancel_user_subscription: {
        Args: { _admin_id: string; _user_id: string }
        Returns: Json
      }
      cleanup_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_expired_magic_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      confirm_user_email: {
        Args: { email_confirmed?: boolean; user_id: string }
        Returns: undefined
      }
      create_subscription: {
        Args: {
          p_paypal_payment_id: string
          p_plan_id: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_user_account: {
        Args: { _user_id: string }
        Returns: Json
      }
      evaluate_access_request: {
        Args: {
          p_action?: string
          p_context?: Json
          p_resource_id?: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: Json
      }
      evaluate_compliance_status: {
        Args: { p_framework: string; p_scope?: Json }
        Returns: Json
      }
      evaluate_response_conditions: {
        Args: { p_conditions: Json; p_context: Json }
        Returns: boolean
      }
      execute_response_action: {
        Args: {
          p_action_type: string
          p_context: Json
          p_execution_id: string
          p_parameters: Json
        }
        Returns: undefined
      }
      export_user_data: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_public_profile_safe: {
        Args: { user_id_param: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          id: string
          role: string
          username: string
        }[]
      }
      get_public_prompt_previews: {
        Args: { limit_count?: number }
        Returns: {
          category: string
          created_at: string
          default_image_path: string
          id: string
          image_path: string
          prompt_preview: string
          prompt_type: string
          title: string
        }[]
      }
      get_user_profile_safe: {
        Args: { user_id_param: string }
        Returns: {
          avatar_url: string
          bio: string
          country: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          membership_tier: string
          phone_number: string
          role: string
          social_links: Json
          username: string
        }[]
      }
      has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      initiate_backup_operation: {
        Args: {
          p_automated?: boolean
          p_backup_type: string
          p_data_sources: Json
        }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_verified_admin: {
        Args: { action_context?: string }
        Returns: boolean
      }
      log_profile_access_attempt: {
        Args: { access_type: string; granted: boolean; target_user_id: string }
        Returns: undefined
      }
      record_discount_usage: {
        Args: {
          discount_code_id_param: string
          payment_history_id_param?: string
          user_id_param?: string
        }
        Returns: boolean
      }
      schedule_security_assessment: {
        Args: {
          p_assessment_type: string
          p_scheduled_date: string
          p_scope?: Json
          p_target_system: string
        }
        Returns: string
      }
      trigger_automated_response: {
        Args: { p_context?: Json; p_event_type: string; p_severity: string }
        Returns: Json
      }
      validate_api_request: {
        Args: {
          p_endpoint: string
          p_ip_address?: string
          p_method: string
          p_request_signature?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
      validate_discount_code: {
        Args: {
          code_text: string
          plan_id_param?: string
          user_id_param?: string
        }
        Returns: {
          discount_type: string
          discount_value: number
          error_message: string
          id: string
          is_valid: boolean
        }[]
      }
      validate_session_integrity: {
        Args: {
          p_fingerprint_hash: string
          p_ip_address?: string
          p_session_token_hash: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      data_classification: "public" | "internal" | "sensitive" | "restricted"
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
      data_classification: ["public", "internal", "sensitive", "restricted"],
    },
  },
} as const
