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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      address_parse_cache: {
        Row: {
          address_hash: string
          area: string | null
          confidence: string | null
          created_at: string
          district: string | null
          id: string
          original_address: string
          source: string | null
          thana: string | null
        }
        Insert: {
          address_hash: string
          area?: string | null
          confidence?: string | null
          created_at?: string
          district?: string | null
          id?: string
          original_address: string
          source?: string | null
          thana?: string | null
        }
        Update: {
          address_hash?: string
          area?: string | null
          confidence?: string | null
          created_at?: string
          district?: string | null
          id?: string
          original_address?: string
          source?: string | null
          thana?: string | null
        }
        Relationships: []
      }
      admin_ai_token_logs: {
        Row: {
          admin_user_id: string | null
          category: string
          created_at: string
          id: string
          metadata: Json | null
          tokens_used: number
        }
        Insert: {
          admin_user_id?: string | null
          category: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number
        }
        Update: {
          admin_user_id?: string | null
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number
        }
        Relationships: []
      }
      admin_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_active_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ads_daily_spend: {
        Row: {
          campaigns_data: Json | null
          clicks: number
          created_at: string
          id: string
          impressions: number
          purchases: number
          spend_bdt: number
          spend_date: string
          spend_usd: number
        }
        Insert: {
          campaigns_data?: Json | null
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          purchases?: number
          spend_bdt?: number
          spend_date: string
          spend_usd?: number
        }
        Update: {
          campaigns_data?: Json | null
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          purchases?: number
          spend_bdt?: number
          spend_date?: string
          spend_usd?: number
        }
        Relationships: []
      }
      ai_chat_sessions: {
        Row: {
          ai_paused: boolean
          created_at: string
          customer_avatar: string | null
          customer_last_seen_at: string | null
          customer_name: string | null
          customer_phone: string | null
          daily_message_count: number
          daily_token_count: number
          id: string
          is_pinned: boolean
          is_read: boolean
          last_message_at: string
          last_reset_date: string | null
          message_count: number
          messages: Json
          total_token_count: number
          updated_at: string
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          ai_paused?: boolean
          created_at?: string
          customer_avatar?: string | null
          customer_last_seen_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_message_count?: number
          daily_token_count?: number
          id?: string
          is_pinned?: boolean
          is_read?: boolean
          last_message_at?: string
          last_reset_date?: string | null
          message_count?: number
          messages?: Json
          total_token_count?: number
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          ai_paused?: boolean
          created_at?: string
          customer_avatar?: string | null
          customer_last_seen_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_message_count?: number
          daily_token_count?: number
          id?: string
          is_pinned?: boolean
          is_read?: boolean
          last_message_at?: string
          last_reset_date?: string | null
          message_count?: number
          messages?: Json
          total_token_count?: number
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training_data: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          category: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          product_id: string | null
          product_name: string | null
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          product_id?: string | null
          product_name?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          product_id?: string | null
          product_name?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bkash_payment_logs: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          payer_msisdn: string | null
          payment_id: string | null
          request: Json | null
          response: Json | null
          status: string | null
          trx_id: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payer_msisdn?: string | null
          payment_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          trx_id?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payer_msisdn?: string | null
          payment_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          trx_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bkash_payment_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bkash_settings: {
        Row: {
          allow_partial: boolean
          app_key: string | null
          app_secret: string | null
          discount_percent: number
          enabled: boolean
          id: number
          min_advance: number
          mode: string
          password: string | null
          refresh_token_cache: string | null
          token_cache: string | null
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          allow_partial?: boolean
          app_key?: string | null
          app_secret?: string | null
          discount_percent?: number
          enabled?: boolean
          id?: number
          min_advance?: number
          mode?: string
          password?: string | null
          refresh_token_cache?: string | null
          token_cache?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          allow_partial?: boolean
          app_key?: string | null
          app_secret?: string | null
          discount_percent?: number
          enabled?: boolean
          id?: number
          min_advance?: number
          mode?: string
          password?: string | null
          refresh_token_cache?: string | null
          token_cache?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      blocked_devices: {
        Row: {
          block_type: string
          block_value: string
          blocked_at: string
          blocked_by: string | null
          expires_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          block_type: string
          block_value: string
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          block_type?: string
          block_value?: string
          blocked_at?: string
          blocked_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      bot_visits: {
        Row: {
          bot_category: string
          bot_name: string
          created_at: string
          id: string
          ip_address: string | null
          page_path: string | null
          referrer_url: string | null
          user_agent: string | null
        }
        Insert: {
          bot_category?: string
          bot_name: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Update: {
          bot_category?: string
          bot_name?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          id: string
          image: string | null
          name: string
          position: number
          slug: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          image?: string | null
          name: string
          position?: number
          slug?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          image?: string | null
          name?: string
          position?: number
          slug?: string | null
        }
        Relationships: []
      }
      connected_sites: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          last_order_at: string | null
          notes: string | null
          secret_key_hash: string
          site_name: string
          site_slug: string
          source_url: string | null
          total_orders: number
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_order_at?: string | null
          notes?: string | null
          secret_key_hash: string
          site_name: string
          site_slug: string
          source_url?: string | null
          total_orders?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_order_at?: string | null
          notes?: string | null
          secret_key_hash?: string
          site_name?: string
          site_slug?: string
          source_url?: string | null
          total_orders?: number
          updated_at?: string
        }
        Relationships: []
      }
      countdown_timers: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_enabled: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_enabled?: boolean
          key: string
          label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_order_amount: number
          starts_at: string
          total_discount_given: number
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          starts_at?: string
          total_discount_given?: number
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_order_amount?: number
          starts_at?: string
          total_discount_given?: number
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          type: string
          visitor_profile_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
          visitor_profile_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_type: string | null
          fingerprint: string | null
          id: string
          message: string
          occurrence_count: number
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_url: string | null
          stack: string | null
          updated_at: string
          user_agent: string | null
          user_role: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_type?: string | null
          fingerprint?: string | null
          id?: string
          message: string
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_url?: string | null
          stack?: string | null
          updated_at?: string
          user_agent?: string | null
          user_role?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_type?: string | null
          fingerprint?: string | null
          id?: string
          message?: string
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_url?: string | null
          stack?: string | null
          updated_at?: string
          user_agent?: string | null
          user_role?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: []
      }
      fb_webhook_dedup: {
        Row: {
          created_at: string
          message_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
        }
        Relationships: []
      }
      flagged_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          severity?: string
        }
        Relationships: []
      }
      forensic_logs: {
        Row: {
          action_details: Json | null
          action_type: string | null
          audio_fingerprint: string | null
          battery_info: Json | null
          behavioral_metrics: Json | null
          canvas_fingerprint: string | null
          created_at: string
          device_fingerprint: string | null
          fonts_list: string[] | null
          hardware_info: Json | null
          id: string
          ip_address: string | null
          languages: string[] | null
          network_info: Json | null
          page_path: string | null
          platform: string | null
          plugins: Json | null
          referrer: string | null
          screen_info: Json | null
          session_duration_ms: number | null
          timezone: string | null
          user_agent: string | null
          visitor_id: string | null
          visitor_profile_id: string | null
          watched_visitor_id: string | null
          webgl_fingerprint: string | null
          webrtc_local_ips: string[] | null
          webrtc_public_ip: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type?: string | null
          audio_fingerprint?: string | null
          battery_info?: Json | null
          behavioral_metrics?: Json | null
          canvas_fingerprint?: string | null
          created_at?: string
          device_fingerprint?: string | null
          fonts_list?: string[] | null
          hardware_info?: Json | null
          id?: string
          ip_address?: string | null
          languages?: string[] | null
          network_info?: Json | null
          page_path?: string | null
          platform?: string | null
          plugins?: Json | null
          referrer?: string | null
          screen_info?: Json | null
          session_duration_ms?: number | null
          timezone?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
          watched_visitor_id?: string | null
          webgl_fingerprint?: string | null
          webrtc_local_ips?: string[] | null
          webrtc_public_ip?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: string | null
          audio_fingerprint?: string | null
          battery_info?: Json | null
          behavioral_metrics?: Json | null
          canvas_fingerprint?: string | null
          created_at?: string
          device_fingerprint?: string | null
          fonts_list?: string[] | null
          hardware_info?: Json | null
          id?: string
          ip_address?: string | null
          languages?: string[] | null
          network_info?: Json | null
          page_path?: string | null
          platform?: string | null
          plugins?: Json | null
          referrer?: string | null
          screen_info?: Json | null
          session_duration_ms?: number | null
          timezone?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
          watched_visitor_id?: string | null
          webgl_fingerprint?: string | null
          webrtc_local_ips?: string[] | null
          webrtc_public_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forensic_logs_watched_visitor_id_fkey"
            columns: ["watched_visitor_id"]
            isOneToOne: false
            referencedRelation: "watched_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_data: {
        Row: {
          created_at: string
          fraudchecker_data: Json | null
          id: string
          phone: string
          steadfast_data: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fraudchecker_data?: Json | null
          id?: string
          phone: string
          steadfast_data?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fraudchecker_data?: Json | null
          id?: string
          phone?: string
          steadfast_data?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      ghost_products: {
        Row: {
          created_at: string
          created_by: string | null
          display_image: string | null
          id: string
          is_active: boolean
          match_keywords: string[]
          name: string
          unavailable_reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_image?: string | null
          id?: string
          is_active?: boolean
          match_keywords?: string[]
          name: string
          unavailable_reason?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_image?: string | null
          id?: string
          is_active?: boolean
          match_keywords?: string[]
          name?: string
          unavailable_reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          alt: string
          created_at: string
          id: string
          image_url: string
          is_enabled: boolean
          position: number
          updated_at: string
        }
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          image_url: string
          is_enabled?: boolean
          position?: number
          updated_at?: string
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          image_url?: string
          is_enabled?: boolean
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      home_sections: {
        Row: {
          accent_color: string | null
          countdown_end: string | null
          created_at: string
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          is_special_offer: boolean
          lock_orders_after_expiry: boolean
          max_items: number
          position: number
          product_ids: string[]
          selection_mode: string
          slug: string
          tag: string | null
          title: string
          updated_at: string
          view_all_link: string | null
        }
        Insert: {
          accent_color?: string | null
          countdown_end?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          is_special_offer?: boolean
          lock_orders_after_expiry?: boolean
          max_items?: number
          position?: number
          product_ids?: string[]
          selection_mode?: string
          slug: string
          tag?: string | null
          title: string
          updated_at?: string
          view_all_link?: string | null
        }
        Update: {
          accent_color?: string | null
          countdown_end?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          is_special_offer?: boolean
          lock_orders_after_expiry?: boolean
          max_items?: number
          position?: number
          product_ids?: string[]
          selection_mode?: string
          slug?: string
          tag?: string | null
          title?: string
          updated_at?: string
          view_all_link?: string | null
        }
        Relationships: []
      }
      import_progress: {
        Row: {
          batch_size: number
          created_at: string
          current_invoice: number
          error_log: Json | null
          id: string
          last_run_at: string | null
          max_invoice: number
          source: string
          started_at: string | null
          status: string
          total_errors: number
          total_imported: number
          total_skipped: number
          updated_at: string
        }
        Insert: {
          batch_size?: number
          created_at?: string
          current_invoice?: number
          error_log?: Json | null
          id?: string
          last_run_at?: string | null
          max_invoice?: number
          source?: string
          started_at?: string | null
          status?: string
          total_errors?: number
          total_imported?: number
          total_skipped?: number
          updated_at?: string
        }
        Update: {
          batch_size?: number
          created_at?: string
          current_invoice?: number
          error_log?: Json | null
          id?: string
          last_run_at?: string | null
          max_invoice?: number
          source?: string
          started_at?: string | null
          status?: string
          total_errors?: number
          total_imported?: number
          total_skipped?: number
          updated_at?: string
        }
        Relationships: []
      }
      incomplete_orders: {
        Row: {
          address: string | null
          attempt_count: number
          cart_snapshot: Json | null
          created_at: string
          customer_name: string | null
          id: string
          phone: string
          reason: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          address?: string | null
          attempt_count?: number
          cart_snapshot?: Json | null
          created_at?: string
          customer_name?: string | null
          id?: string
          phone: string
          reason: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          address?: string | null
          attempt_count?: number
          cart_snapshot?: Json | null
          created_at?: string
          customer_name?: string | null
          id?: string
          phone?: string
          reason?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_or_email: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_or_email: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_or_email?: string
        }
        Relationships: []
      }
      marketing_audiences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filter_rules: Json
          id: string
          is_active: boolean
          name: string
          recipient_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_rules?: Json
          id?: string
          is_active?: boolean
          name: string
          recipient_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_rules?: Json
          id?: string
          is_active?: boolean
          name?: string
          recipient_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          audience_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          email_html: string | null
          email_subject: string | null
          id: string
          message_body: string | null
          name: string
          push_title: string | null
          push_url: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          total_cost: number
          total_failed: number
          total_recipients: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          message_body?: string | null
          name: string
          push_title?: string | null
          push_url?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_cost?: number
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          message_body?: string | null
          name?: string
          push_title?: string | null
          push_url?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_cost?: number
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "marketing_audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          html_body: string
          id: string
          is_active: boolean
          name: string
          preview_text: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html_body: string
          id?: string
          is_active?: boolean
          name: string
          preview_text?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_text?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_promotions: {
        Row: {
          banner_image: string | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          display_order: number
          ends_at: string | null
          id: string
          promo_type: string
          starts_at: string | null
          status: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          banner_image?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          display_order?: number
          ends_at?: string | null
          id?: string
          promo_type?: string
          starts_at?: string | null
          status?: string
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          banner_image?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          display_order?: number
          ends_at?: string | null
          id?: string
          promo_type?: string
          starts_at?: string | null
          status?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_sends: {
        Row: {
          campaign_id: string | null
          channel: string
          cost: number
          created_at: string
          error_message: string | null
          id: string
          message_body: string | null
          provider_response: Json | null
          recipient: string
          recipient_name: string | null
          segments: number | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          channel: string
          cost?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          provider_response?: Json | null
          recipient: string
          recipient_name?: string | null
          segments?: number | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          cost?: number
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          provider_response?: Json | null
          recipient?: string
          recipient_name?: string | null
          segments?: number | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sms_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      message_flags: {
        Row: {
          created_at: string
          id: string
          keyword: string
          message_id: string
          reviewed: boolean
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          message_id: string
          reviewed?: boolean
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          message_id?: string
          reviewed?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mina_knowledge_domains: {
        Row: {
          content: string
          created_at: string
          display_order: number
          domain_key: string
          id: string
          is_active: boolean
          keywords: string[] | null
          last_used_at: string | null
          short_description: string
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          content?: string
          created_at?: string
          display_order?: number
          domain_key: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          last_used_at?: string | null
          short_description: string
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          display_order?: number
          domain_key?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          last_used_at?: string | null
          short_description?: string
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      order_edit_locks: {
        Row: {
          heartbeat_at: string
          id: string
          locked_at: string
          order_id: string
          user_email: string | null
          user_id: string
          user_name: string | null
          user_photo: string | null
        }
        Insert: {
          heartbeat_at?: string
          id?: string
          locked_at?: string
          order_id: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
          user_photo?: string | null
        }
        Update: {
          heartbeat_at?: string
          id?: string
          locked_at?: string
          order_id?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          user_photo?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          delivered_qty: number | null
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          returned_qty: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivered_qty?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          returned_qty?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          delivered_qty?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          returned_qty?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          action: string
          admin_email: string | null
          created_at: string
          customer_name: string | null
          id: string
          order_id: string | null
          order_number: string
          phone: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          order_id?: string | null
          order_number: string
          phone?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          order_id?: string | null
          order_number?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          id: string
          order_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          order_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          advance: number
          alt_phone: string | null
          bkash_payer_msisdn: string | null
          bkash_payment_id: string | null
          bkash_trx_id: string | null
          connected_site_id: string | null
          consignment_id: string | null
          courier_delivery_type: number | null
          courier_note: string | null
          courier_provider: string | null
          courier_remarks: string | null
          courier_total_lot: number | null
          created_at: string
          created_by_admin_id: string | null
          customer_facing_id: string | null
          customer_name: string
          delivery_area: string | null
          delivery_charge: number | null
          delivery_status: string | null
          discount: number
          district: string | null
          id: string
          is_courier_entered: boolean
          is_deleted: boolean
          is_preorder_order: boolean
          is_printed: boolean
          last_status_changed_by: string | null
          note: string | null
          notify_after: string | null
          order_id: string
          paid_amount: number | null
          payment_method: string
          payment_status: string
          phone: string
          pre_date: string | null
          print_note: boolean
          status: string
          thana: string | null
          total_amount: number
          tracking_code: string | null
          traffic_source: string | null
          updated_at: string
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          address: string
          advance?: number
          alt_phone?: string | null
          bkash_payer_msisdn?: string | null
          bkash_payment_id?: string | null
          bkash_trx_id?: string | null
          connected_site_id?: string | null
          consignment_id?: string | null
          courier_delivery_type?: number | null
          courier_note?: string | null
          courier_provider?: string | null
          courier_remarks?: string | null
          courier_total_lot?: number | null
          created_at?: string
          created_by_admin_id?: string | null
          customer_facing_id?: string | null
          customer_name: string
          delivery_area?: string | null
          delivery_charge?: number | null
          delivery_status?: string | null
          discount?: number
          district?: string | null
          id?: string
          is_courier_entered?: boolean
          is_deleted?: boolean
          is_preorder_order?: boolean
          is_printed?: boolean
          last_status_changed_by?: string | null
          note?: string | null
          notify_after?: string | null
          order_id?: string
          paid_amount?: number | null
          payment_method?: string
          payment_status?: string
          phone: string
          pre_date?: string | null
          print_note?: boolean
          status?: string
          thana?: string | null
          total_amount?: number
          tracking_code?: string | null
          traffic_source?: string | null
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          address?: string
          advance?: number
          alt_phone?: string | null
          bkash_payer_msisdn?: string | null
          bkash_payment_id?: string | null
          bkash_trx_id?: string | null
          connected_site_id?: string | null
          consignment_id?: string | null
          courier_delivery_type?: number | null
          courier_note?: string | null
          courier_provider?: string | null
          courier_remarks?: string | null
          courier_total_lot?: number | null
          created_at?: string
          created_by_admin_id?: string | null
          customer_facing_id?: string | null
          customer_name?: string
          delivery_area?: string | null
          delivery_charge?: number | null
          delivery_status?: string | null
          discount?: number
          district?: string | null
          id?: string
          is_courier_entered?: boolean
          is_deleted?: boolean
          is_preorder_order?: boolean
          is_printed?: boolean
          last_status_changed_by?: string | null
          note?: string | null
          notify_after?: string | null
          order_id?: string
          paid_amount?: number | null
          payment_method?: string
          payment_status?: string
          phone?: string
          pre_date?: string | null
          print_note?: boolean
          status?: string
          thana?: string | null
          total_amount?: number
          tracking_code?: string | null
          traffic_source?: string | null
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_connected_site_id_fkey"
            columns: ["connected_site_id"]
            isOneToOne: false
            referencedRelation: "connected_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tag?: string
        }
        Relationships: []
      }
      product_answers: {
        Row: {
          answer: string
          created_at: string
          guest_name: string | null
          has_flagged_keyword: boolean
          helpful_count: number
          id: string
          is_ai: boolean
          is_official: boolean
          moderation_reason: string | null
          question_id: string
          status: string
          visitor_profile_id: string | null
          was_auto_approved: boolean
        }
        Insert: {
          answer: string
          created_at?: string
          guest_name?: string | null
          has_flagged_keyword?: boolean
          helpful_count?: number
          id?: string
          is_ai?: boolean
          is_official?: boolean
          moderation_reason?: string | null
          question_id: string
          status?: string
          visitor_profile_id?: string | null
          was_auto_approved?: boolean
        }
        Update: {
          answer?: string
          created_at?: string
          guest_name?: string | null
          has_flagged_keyword?: boolean
          helpful_count?: number
          id?: string
          is_ai?: boolean
          is_official?: boolean
          moderation_reason?: string | null
          question_id?: string
          status?: string
          visitor_profile_id?: string | null
          was_auto_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "product_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_answers_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_answers_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_landing_pages: {
        Row: {
          benefits: Json
          created_at: string
          description: Json
          faqs: Json
          germination: string | null
          headline: string | null
          highlights: Json
          id: string
          pack_size: string | null
          reviews: Json
          sections: Json
          slug: string
          subheadline: string | null
          updated_at: string
          usage_steps: Json
        }
        Insert: {
          benefits?: Json
          created_at?: string
          description?: Json
          faqs?: Json
          germination?: string | null
          headline?: string | null
          highlights?: Json
          id?: string
          pack_size?: string | null
          reviews?: Json
          sections?: Json
          slug: string
          subheadline?: string | null
          updated_at?: string
          usage_steps?: Json
        }
        Update: {
          benefits?: Json
          created_at?: string
          description?: Json
          faqs?: Json
          germination?: string | null
          headline?: string | null
          highlights?: Json
          id?: string
          pack_size?: string | null
          reviews?: Json
          sections?: Json
          slug?: string
          subheadline?: string | null
          updated_at?: string
          usage_steps?: Json
        }
        Relationships: []
      }
      product_question_votes: {
        Row: {
          created_at: string
          guest_token: string | null
          id: string
          question_id: string
          visitor_profile_id: string | null
          vote: number
        }
        Insert: {
          created_at?: string
          guest_token?: string | null
          id?: string
          question_id: string
          visitor_profile_id?: string | null
          vote: number
        }
        Update: {
          created_at?: string
          guest_token?: string | null
          id?: string
          question_id?: string
          visitor_profile_id?: string | null
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "product_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_question_votes_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_question_votes_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          ai_answer: string | null
          answer_count: number
          created_at: string
          guest_name: string | null
          has_flagged_keyword: boolean
          id: string
          is_answered: boolean
          like_count: number
          moderation_reason: string | null
          product_id: string
          question: string
          status: string
          updated_at: string
          visitor_profile_id: string | null
          was_auto_approved: boolean
        }
        Insert: {
          ai_answer?: string | null
          answer_count?: number
          created_at?: string
          guest_name?: string | null
          has_flagged_keyword?: boolean
          id?: string
          is_answered?: boolean
          like_count?: number
          moderation_reason?: string | null
          product_id: string
          question: string
          status?: string
          updated_at?: string
          visitor_profile_id?: string | null
          was_auto_approved?: boolean
        }
        Update: {
          ai_answer?: string | null
          answer_count?: number
          created_at?: string
          guest_name?: string | null
          has_flagged_keyword?: boolean
          id?: string
          is_answered?: boolean
          like_count?: number
          moderation_reason?: string | null
          product_id?: string
          question?: string
          status?: string
          updated_at?: string
          visitor_profile_id?: string | null
          was_auto_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          guest_name: string | null
          id: string
          media_urls: string[] | null
          order_id: string | null
          product_id: string
          rating: number
          status: string
          updated_at: string
          visitor_profile_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          media_urls?: string[] | null
          order_id?: string | null
          product_id: string
          rating: number
          status?: string
          updated_at?: string
          visitor_profile_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guest_name?: string | null
          id?: string
          media_urls?: string[] | null
          order_id?: string | null
          product_id?: string
          rating?: number
          status?: string
          updated_at?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          buying_price: number | null
          cash_back: number
          categories: string[]
          category: string | null
          combo_components: Json | null
          created_at: string
          full_description: string | null
          id: string
          image_gallery: string[] | null
          incoming_stock: number
          is_combo: boolean
          is_hidden: boolean
          is_preorder: boolean
          name: string
          offer_price: number | null
          position: number
          preorder_advance: number
          preorder_note: string | null
          product_image: string | null
          regular_price: number
          related_offer_discounts: Json | null
          related_offer_product_ids: string[] | null
          reserved_stock: number
          short_description: string | null
          sku: string
          slug: string | null
          special_offer_enabled: boolean
          special_offer_ends_at: string | null
          special_offer_label: string | null
          special_offer_lock_after_expiry: boolean
          special_offer_starts_at: string | null
          special_offer_type: string | null
          special_offer_value: number | null
          stock: number
          stock_out_alert_sent_at: string | null
          stock_out_custom_text: string | null
          stock_out_display: string
          stock_status_override: string
          tag: string | null
          unlock_threshold: number | null
          updated_at: string
          variant_label: string | null
          variants: string[] | null
          video_url: string | null
        }
        Insert: {
          buying_price?: number | null
          cash_back?: number
          categories?: string[]
          category?: string | null
          combo_components?: Json | null
          created_at?: string
          full_description?: string | null
          id?: string
          image_gallery?: string[] | null
          incoming_stock?: number
          is_combo?: boolean
          is_hidden?: boolean
          is_preorder?: boolean
          name: string
          offer_price?: number | null
          position?: number
          preorder_advance?: number
          preorder_note?: string | null
          product_image?: string | null
          regular_price?: number
          related_offer_discounts?: Json | null
          related_offer_product_ids?: string[] | null
          reserved_stock?: number
          short_description?: string | null
          sku: string
          slug?: string | null
          special_offer_enabled?: boolean
          special_offer_ends_at?: string | null
          special_offer_label?: string | null
          special_offer_lock_after_expiry?: boolean
          special_offer_starts_at?: string | null
          special_offer_type?: string | null
          special_offer_value?: number | null
          stock?: number
          stock_out_alert_sent_at?: string | null
          stock_out_custom_text?: string | null
          stock_out_display?: string
          stock_status_override?: string
          tag?: string | null
          unlock_threshold?: number | null
          updated_at?: string
          variant_label?: string | null
          variants?: string[] | null
          video_url?: string | null
        }
        Update: {
          buying_price?: number | null
          cash_back?: number
          categories?: string[]
          category?: string | null
          combo_components?: Json | null
          created_at?: string
          full_description?: string | null
          id?: string
          image_gallery?: string[] | null
          incoming_stock?: number
          is_combo?: boolean
          is_hidden?: boolean
          is_preorder?: boolean
          name?: string
          offer_price?: number | null
          position?: number
          preorder_advance?: number
          preorder_note?: string | null
          product_image?: string | null
          regular_price?: number
          related_offer_discounts?: Json | null
          related_offer_product_ids?: string[] | null
          reserved_stock?: number
          short_description?: string | null
          sku?: string
          slug?: string | null
          special_offer_enabled?: boolean
          special_offer_ends_at?: string | null
          special_offer_label?: string | null
          special_offer_lock_after_expiry?: boolean
          special_offer_starts_at?: string | null
          special_offer_type?: string | null
          special_offer_value?: number | null
          stock?: number
          stock_out_alert_sent_at?: string | null
          stock_out_custom_text?: string | null
          stock_out_display?: string
          stock_status_override?: string
          tag?: string | null
          unlock_threshold?: number | null
          updated_at?: string
          variant_label?: string | null
          variants?: string[] | null
          video_url?: string | null
        }
        Relationships: []
      }
      push_broadcast_logs: {
        Row: {
          body: string
          created_at: string
          failed_count: number
          filters: Json | null
          id: string
          sent_by: string | null
          sent_by_name: string | null
          sent_count: number
          title: string
          total_recipients: number
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          failed_count?: number
          filters?: Json | null
          id?: string
          sent_by?: string | null
          sent_by_name?: string | null
          sent_count?: number
          title: string
          total_recipients?: number
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          failed_count?: number
          filters?: Json | null
          id?: string
          sent_by?: string | null
          sent_by_name?: string | null
          sent_count?: number
          title?: string
          total_recipients?: number
          url?: string | null
        }
        Relationships: []
      }
      push_prompt_events: {
        Row: {
          action: string
          context: string
          created_at: string
          id: string
          order_id: string | null
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          action: string
          context?: string
          created_at?: string
          id?: string
          order_id?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          action?: string
          context?: string
          created_at?: string
          id?: string
          order_id?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string | null
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      push_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      rag_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_documents: {
        Row: {
          content_preview: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          id: string
          status: string | null
          title: string
          total_chunks: number | null
          updated_at: string
        }
        Insert: {
          content_preview?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          status?: string | null
          title: string
          total_chunks?: number | null
          updated_at?: string
        }
        Update: {
          content_preview?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          status?: string | null
          title?: string
          total_chunks?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          address: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string
          thana: string | null
          updated_at: string
          visitor_profile_id: string
        }
        Insert: {
          address: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          thana?: string | null
          updated_at?: string
          visitor_profile_id: string
        }
        Update: {
          address?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          thana?: string | null
          updated_at?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_addresses_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_addresses_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_replies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_type: string
          priority: number
          reply_text: string
          trigger_patterns: string[]
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          priority?: number
          reply_text: string
          trigger_patterns?: string[]
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          priority?: number
          reply_text?: string
          trigger_patterns?: string[]
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      search_forwards: {
        Row: {
          admin_note: string | null
          created_at: string
          created_by: string | null
          from_keyword: string
          from_keyword_normalized: string
          hit_count: number
          id: string
          is_active: boolean
          to_keyword: string | null
          to_product_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          from_keyword: string
          from_keyword_normalized: string
          hit_count?: number
          id?: string
          is_active?: boolean
          to_keyword?: string | null
          to_product_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          created_by?: string | null
          from_keyword?: string
          from_keyword_normalized?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          to_keyword?: string | null
          to_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_forwards_to_product_id_fkey"
            columns: ["to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_forwards_to_product_id_fkey"
            columns: ["to_product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          had_results: boolean
          id: string
          ip: string | null
          query_normalized: string
          query_raw: string
          result_count: number
          source: string | null
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          created_at?: string
          had_results?: boolean
          id?: string
          ip?: string | null
          query_normalized: string
          query_raw: string
          result_count?: number
          source?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          created_at?: string
          had_results?: boolean
          id?: string
          ip?: string | null
          query_normalized?: string
          query_raw?: string
          result_count?: number
          source?: string | null
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: []
      }
      search_misses: {
        Row: {
          admin_note: string | null
          created_at: string
          ghost_product_id: string | null
          id: string
          last_searched_at: string
          query_normalized: string
          query_sample: string
          search_count: number
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          ghost_product_id?: string | null
          id?: string
          last_searched_at?: string
          query_normalized: string
          query_sample: string
          search_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          ghost_product_id?: string | null
          id?: string
          last_searched_at?: string
          query_normalized?: string
          query_sample?: string
          search_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_batch_counters: {
        Row: {
          count: number
          first_at: string
          key: string
          total_value: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          count?: number
          first_at?: string
          key: string
          total_value?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          count?: number
          first_at?: string
          key?: string
          total_value?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          phone: string
          reason: string | null
          result: Json | null
          sent_by_admin: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          phone: string
          reason?: string | null
          result?: Json | null
          sent_by_admin?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          phone?: string
          reason?: string | null
          result?: Json | null
          sent_by_admin?: string | null
          status?: string
        }
        Relationships: []
      }
      social_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          visitor_profile_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          visitor_profile_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      social_groups: {
        Row: {
          category: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_featured: boolean
          is_private: boolean
          member_count: number
          name: string
          post_count: number
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          is_private?: boolean
          member_count?: number
          name: string
          post_count?: number
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          is_private?: boolean
          member_count?: number
          name?: string
          post_count?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_reply: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          is_read: boolean
          message: string
          replied_at: string | null
          replied_by: string | null
          replies: Json | null
          status: string
          subject: string | null
          updated_at: string
          visitor_profile_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_read?: boolean
          message: string
          replied_at?: string | null
          replied_by?: string | null
          replies?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string
          visitor_profile_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_read?: boolean
          message?: string
          replied_at?: string | null
          replied_by?: string | null
          replies?: Json | null
          status?: string
          subject?: string | null
          updated_at?: string
          visitor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_reports: {
        Row: {
          admin_notes: Json
          admin_response: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          description: string
          id: string
          order_id: string | null
          order_number: string | null
          priority: string
          report_type: string
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string | null
          updated_at: string
          visitor_profile_id: string | null
        }
        Insert: {
          admin_notes?: Json
          admin_response?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description: string
          id?: string
          order_id?: string | null
          order_number?: string | null
          priority?: string
          report_type?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          visitor_profile_id?: string | null
        }
        Update: {
          admin_notes?: Json
          admin_response?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description?: string
          id?: string
          order_id?: string | null
          order_number?: string | null
          priority?: string
          report_type?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          visitor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_reports_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_reports_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
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
      verification_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          full_name: string
          id: string
          nid_number: string | null
          photo_url: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: string | null
          status: string
          updated_at: string
          visitor_profile_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          full_name: string
          id?: string
          nid_number?: string | null
          photo_url?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: string | null
          status?: string
          updated_at?: string
          visitor_profile_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          full_name?: string
          id?: string
          nid_number?: string | null
          photo_url?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: string | null
          status?: string
          updated_at?: string
          visitor_profile_id?: string
        }
        Relationships: []
      }
      visitor_linked_phones: {
        Row: {
          created_at: string
          credit_charged: number
          id: string
          phone: string
          slot: number
          verified_at: string
          visitor_profile_id: string
        }
        Insert: {
          created_at?: string
          credit_charged?: number
          id?: string
          phone: string
          slot: number
          verified_at?: string
          visitor_profile_id: string
        }
        Update: {
          created_at?: string
          credit_charged?: number
          id?: string
          phone?: string
          slot?: number
          verified_at?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_linked_phones_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_linked_phones_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_profiles: {
        Row: {
          address: string | null
          age: number | null
          alt_phone: string | null
          bio: string | null
          cover_photo: string | null
          created_at: string
          credit_balance: number
          district: string | null
          follower_count: number
          following_count: number
          gender: string | null
          id: string
          is_verified: boolean
          last_active_at: string | null
          name: string | null
          password_hash: string | null
          phone: string
          phone_verified: boolean
          profile_picture: string | null
          profile_ring: string | null
          session_invalidated_at: string | null
          session_token: string | null
          shadow_moderated: boolean
          shadow_moderated_at: string | null
          shadow_moderated_reason: string | null
          thana: string | null
          updated_at: string
          user_type: string | null
          username: string | null
          visitor_id: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          alt_phone?: string | null
          bio?: string | null
          cover_photo?: string | null
          created_at?: string
          credit_balance?: number
          district?: string | null
          follower_count?: number
          following_count?: number
          gender?: string | null
          id?: string
          is_verified?: boolean
          last_active_at?: string | null
          name?: string | null
          password_hash?: string | null
          phone: string
          phone_verified?: boolean
          profile_picture?: string | null
          profile_ring?: string | null
          session_invalidated_at?: string | null
          session_token?: string | null
          shadow_moderated?: boolean
          shadow_moderated_at?: string | null
          shadow_moderated_reason?: string | null
          thana?: string | null
          updated_at?: string
          user_type?: string | null
          username?: string | null
          visitor_id: string
        }
        Update: {
          address?: string | null
          age?: number | null
          alt_phone?: string | null
          bio?: string | null
          cover_photo?: string | null
          created_at?: string
          credit_balance?: number
          district?: string | null
          follower_count?: number
          following_count?: number
          gender?: string | null
          id?: string
          is_verified?: boolean
          last_active_at?: string | null
          name?: string | null
          password_hash?: string | null
          phone?: string
          phone_verified?: boolean
          profile_picture?: string | null
          profile_ring?: string | null
          session_invalidated_at?: string | null
          session_token?: string | null
          shadow_moderated?: boolean
          shadow_moderated_at?: string | null
          shadow_moderated_reason?: string | null
          thana?: string | null
          updated_at?: string
          user_type?: string | null
          username?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_profiles_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          access_allowed: boolean
          admin_notes: string | null
          avg_page_load_ms: number | null
          created_at: string
          fingerprint: string
          first_visit_at: string
          id: string
          ip_addresses: string[] | null
          referrer_url: string | null
          total_active_time_seconds: number
          total_visit_count: number
          traffic_source: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          access_allowed?: boolean
          admin_notes?: string | null
          avg_page_load_ms?: number | null
          created_at?: string
          fingerprint: string
          first_visit_at?: string
          id?: string
          ip_addresses?: string[] | null
          referrer_url?: string | null
          total_active_time_seconds?: number
          total_visit_count?: number
          traffic_source?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          access_allowed?: boolean
          admin_notes?: string | null
          avg_page_load_ms?: number | null
          created_at?: string
          fingerprint?: string
          first_visit_at?: string
          id?: string
          ip_addresses?: string[] | null
          referrer_url?: string | null
          total_active_time_seconds?: number
          total_visit_count?: number
          traffic_source?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      watched_visitors: {
        Row: {
          added_by: string | null
          alert_count: number
          alert_phone: string
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_alert_at: string | null
          name: string | null
          phone: string | null
          reason: string | null
          updated_at: string
          visitor_id: string | null
          visitor_profile_id: string | null
        }
        Insert: {
          added_by?: string | null
          alert_count?: number
          alert_phone?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_alert_at?: string | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Update: {
          added_by?: string | null
          alert_count?: number
          alert_phone?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_alert_at?: string | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          updated_at?: string
          visitor_id?: string | null
          visitor_profile_id?: string | null
        }
        Relationships: []
      }
      wholesale_applications: {
        Row: {
          admin_notes: string | null
          business_name: string | null
          created_at: string
          district: string | null
          id: string
          monthly_volume: string | null
          name: string
          notes: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          visitor_profile_id: string
        }
        Insert: {
          admin_notes?: string | null
          business_name?: string | null
          created_at?: string
          district?: string | null
          id?: string
          monthly_volume?: string | null
          name: string
          notes?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          visitor_profile_id: string
        }
        Update: {
          admin_notes?: string | null
          business_name?: string | null
          created_at?: string
          district?: string | null
          id?: string
          monthly_volume?: string | null
          name?: string
          notes?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          visitor_profile_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          visitor_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          visitor_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_visitor_profile_id_fkey"
            columns: ["visitor_profile_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_public: {
        Row: {
          cash_back: number | null
          categories: string[] | null
          category: string | null
          combo_components: Json | null
          created_at: string | null
          full_description: string | null
          id: string | null
          image_gallery: string[] | null
          incoming_stock: number | null
          is_combo: boolean | null
          is_hidden: boolean | null
          is_preorder: boolean | null
          name: string | null
          offer_price: number | null
          position: number | null
          preorder_advance: number | null
          preorder_note: string | null
          product_image: string | null
          regular_price: number | null
          related_offer_discounts: Json | null
          related_offer_product_ids: string[] | null
          reserved_stock: number | null
          short_description: string | null
          sku: string | null
          slug: string | null
          special_offer_enabled: boolean | null
          special_offer_ends_at: string | null
          special_offer_label: string | null
          special_offer_lock_after_expiry: boolean | null
          special_offer_starts_at: string | null
          special_offer_type: string | null
          special_offer_value: number | null
          stock: number | null
          stock_out_custom_text: string | null
          stock_out_display: string | null
          stock_status_override: string | null
          tag: string | null
          unlock_threshold: number | null
          variant_label: string | null
          variants: string[] | null
          video_url: string | null
        }
        Insert: {
          cash_back?: number | null
          categories?: string[] | null
          category?: string | null
          combo_components?: Json | null
          created_at?: string | null
          full_description?: string | null
          id?: string | null
          image_gallery?: string[] | null
          incoming_stock?: number | null
          is_combo?: boolean | null
          is_hidden?: boolean | null
          is_preorder?: boolean | null
          name?: string | null
          offer_price?: number | null
          position?: number | null
          preorder_advance?: number | null
          preorder_note?: string | null
          product_image?: string | null
          regular_price?: number | null
          related_offer_discounts?: Json | null
          related_offer_product_ids?: string[] | null
          reserved_stock?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          special_offer_enabled?: boolean | null
          special_offer_ends_at?: string | null
          special_offer_label?: string | null
          special_offer_lock_after_expiry?: boolean | null
          special_offer_starts_at?: string | null
          special_offer_type?: string | null
          special_offer_value?: number | null
          stock?: number | null
          stock_out_custom_text?: string | null
          stock_out_display?: string | null
          stock_status_override?: string | null
          tag?: string | null
          unlock_threshold?: number | null
          variant_label?: string | null
          variants?: string[] | null
          video_url?: string | null
        }
        Update: {
          cash_back?: number | null
          categories?: string[] | null
          category?: string | null
          combo_components?: Json | null
          created_at?: string | null
          full_description?: string | null
          id?: string | null
          image_gallery?: string[] | null
          incoming_stock?: number | null
          is_combo?: boolean | null
          is_hidden?: boolean | null
          is_preorder?: boolean | null
          name?: string | null
          offer_price?: number | null
          position?: number | null
          preorder_advance?: number | null
          preorder_note?: string | null
          product_image?: string | null
          regular_price?: number | null
          related_offer_discounts?: Json | null
          related_offer_product_ids?: string[] | null
          reserved_stock?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          special_offer_enabled?: boolean | null
          special_offer_ends_at?: string | null
          special_offer_label?: string | null
          special_offer_lock_after_expiry?: boolean | null
          special_offer_starts_at?: string | null
          special_offer_type?: string | null
          special_offer_value?: number | null
          stock?: number | null
          stock_out_custom_text?: string | null
          stock_out_display?: string | null
          stock_status_override?: string | null
          tag?: string | null
          unlock_threshold?: number | null
          variant_label?: string | null
          variants?: string[] | null
          video_url?: string | null
        }
        Relationships: []
      }
      visitor_profiles_public: {
        Row: {
          age: number | null
          bio: string | null
          created_at: string | null
          district: string | null
          gender: string | null
          id: string | null
          is_verified: boolean | null
          name: string | null
          profile_picture: string | null
          thana: string | null
          updated_at: string | null
          user_type: string | null
          username: string | null
          visitor_id: string | null
        }
        Insert: {
          age?: number | null
          bio?: string | null
          created_at?: string | null
          district?: string | null
          gender?: string | null
          id?: string | null
          is_verified?: boolean | null
          name?: string | null
          profile_picture?: string | null
          thana?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Update: {
          age?: number | null
          bio?: string | null
          created_at?: string | null
          district?: string | null
          gender?: string | null
          id?: string | null
          is_verified?: boolean | null
          name?: string | null
          profile_picture?: string | null
          thana?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_profiles_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_app_setting: {
        Args: { p_key: string }
        Returns: undefined
      }
      save_app_setting: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      add_linked_phone_with_otp: {
        Args: { p_otp_code: string; p_phone: string; p_session_token: string }
        Returns: Json
      }
      add_order_upsell: {
        Args: { p_offer_id: string; p_order_id: string; p_quantity?: number }
        Returns: Json
      }
      apply_search_forward: {
        Args: { p_query: string }
        Returns: {
          forward_id: string
          forwarded: boolean
          original_query: string
          resolved_query: string
          to_product_id: string
        }[]
      }
      build_auto_username: {
        Args: { p_name: string; p_phone: string }
        Returns: string
      }
      bump_search_forward_hit: { Args: { p_id: string }; Returns: undefined }
      bump_sms_batch: {
        Args: { _key: string; _value?: number }
        Returns: undefined
      }
      cast_poll_vote: {
        Args: {
          _option_index: number
          _poll_id: string
          _voter_profile_id: string
        }
        Returns: undefined
      }
      cast_product_question_vote: {
        Args: {
          p_guest_token: string
          p_question_id: string
          p_visitor_profile_id: string
          p_vote: number
        }
        Returns: Json
      }
      check_watched_activity: {
        Args: {
          _ip?: string
          _phone?: string
          _visitor_id?: string
          _visitor_profile_id?: string
        }
        Returns: {
          alert_phone: string
          name: string
          reason: string
          should_alert: boolean
          watch_id: string
        }[]
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_old_storage: { Args: never; Returns: Json }
      create_social_group_paid:
        | {
            Args: {
              p_description?: string
              p_icon?: string
              p_name: string
              p_profile_id: string
              p_slug: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_description?: string
              p_icon?: string
              p_name: string
              p_privacy?: string
              p_profile_id: string
              p_slug: string
            }
            Returns: Json
          }
      create_social_page_paid: {
        Args: {
          p_avatar?: string
          p_category?: string
          p_description?: string
          p_name: string
          p_profile_id: string
          p_slug: string
        }
        Returns: Json
      }
      current_customer_phone: { Args: never; Returns: string }
      current_is_social_super_viewer: { Args: never; Returns: boolean }
      current_owns_order: { Args: { _order_id: string }; Returns: boolean }
      current_visitor_fingerprint: { Args: never; Returns: string }
      current_visitor_is_shadow_moderated: { Args: never; Returns: boolean }
      current_visitor_profile_id: { Args: never; Returns: string }
      customer_owns_order: { Args: { _order_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      evaluate_social_badges: {
        Args: { _profile_id: string }
        Returns: string[]
      }
      fuzzy_search_products: {
        Args: {
          max_results?: number
          search_query: string
          similarity_threshold?: number
        }
        Returns: {
          category: string
          full_description: string
          id: string
          name: string
          nursery_price: number
          offer_price: number
          paikari_maximum: number
          product_image: string
          regular_price: number
          reserved_stock: number
          short_description: string
          similarity_score: number
          sku: string
          stock: number
          tag: string
        }[]
      }
      fuzzy_search_products_v2: {
        Args: {
          max_results?: number
          search_query: string
          similarity_threshold?: number
        }
        Returns: {
          category: string
          id: string
          is_ghost: boolean
          name: string
          offer_price: number
          product_image: string
          regular_price: number
          similarity_score: number
          sku: string
          stock: number
          unavailable_reason: string
        }[]
      }
      generate_unique_auto_username: {
        Args: { p_exclude_id?: string; p_name: string; p_phone: string }
        Returns: string
      }
      get_confirmed_order_status_counts: {
        Args: { p_date_from?: string; p_search?: string; p_statuses: string[] }
        Returns: {
          cnt: number
          status: string
        }[]
      }
      get_customer_leaderboard_rank: {
        Args: { p_visitor_profile_id: string }
        Returns: {
          rank: number
          total: number
          total_orders: number
          total_spent: number
        }[]
      }
      get_delivered_revenue_total: { Args: never; Returns: number }
      get_indexable_social_posts: {
        Args: { p_limit?: number }
        Returns: {
          engagement_score: number
          id: string
          image_count: number
          updated_at: string
        }[]
      }
      get_live_order_feed: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          customer_label: string
          district: string
          id: string
          product: string
        }[]
      }
      get_low_stock_products: {
        Args: never
        Returns: {
          available_stock: number
          current_stock: number
          incoming_stock: number
          last_30d_sold: number
          product_id: string
          product_image: string
          product_name: string
          product_sku: string
          reserved_stock: number
        }[]
      }
      get_mina_knowledge: {
        Args: { _domain_key: string }
        Returns: {
          content: string
          domain_key: string
          title: string
        }[]
      }
      get_my_credit_history: {
        Args: { p_limit?: number; p_session_token: string }
        Returns: Json
      }
      get_order_status_counts: {
        Args: { p_date_from?: string; p_search?: string; p_statuses: string[] }
        Returns: {
          cnt: number
          status: string
        }[]
      }
      get_post_bonus_estimate: { Args: { _post_id: string }; Returns: number }
      get_post_lifetime_earning: { Args: { _post_id: string }; Returns: number }
      get_products_30d_sales: {
        Args: { p_product_ids: string[] }
        Returns: {
          product_id: string
          total_sold: number
        }[]
      }
      get_sidebar_counts: { Args: never; Returns: Json }
      get_social_leaderboard: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          comments_received: number
          is_verified: boolean
          likes_received: number
          name: string
          posts: number
          profile_picture: string
          score: number
          username: string
          visitor_profile_id: string
        }[]
      }
      get_social_user_stats: { Args: { _profile_id: string }; Returns: Json }
      get_stock_out_pending_products: {
        Args: never
        Returns: {
          alert_sent_at: string
          available_stock: number
          current_stock: number
          product_id: string
          product_image: string
          product_name: string
          product_sku: string
          reserved_stock: number
        }[]
      }
      get_top_customers_public: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          customer_tag: string
          district: string
          name: string
          phone: string
          profile_picture: string
          rank: number
          total_orders: number
          total_spent: number
          visitor_profile_id: string
        }[]
      }
      get_top_selling_products: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          id: string
          name: string
          offer_price: number
          product_image: string
          regular_price: number
          slug: string
          stock: number
          total_sold: number
        }[]
      }
      get_top_wholesale_customers_public: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          customer_tag: string
          district: string
          name: string
          phone: string
          profile_picture: string
          rank: number
          total_orders: number
          total_spent: number
          visitor_profile_id: string
        }[]
      }
      get_watched_linked_aliases: {
        Args: { _watched_id: string }
        Returns: {
          confidence: string
          evidence_score: number
          first_seen: string
          hit_count: number
          last_seen: string
          profile_name: string
          profile_phone: string
          sample_ips: string[]
          sample_user_agents: string[]
          sample_webrtc_ips: string[]
          shared_signals: string[]
          visitor_id: string
          visitor_profile_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string; p_discount_amount: number }
        Returns: undefined
      }
      increment_saved_reply_usage: {
        Args: { p_reply_id: string }
        Returns: undefined
      }
      increment_social_share: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      is_admin_or_moderator: { Args: { _uid: string }; Returns: boolean }
      is_bkash_enabled: { Args: never; Returns: boolean }
      is_shadow_moderated_profile: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      is_social_super_viewer: {
        Args: { _profile_id: string; _session_token: string }
        Returns: boolean
      }
      is_visitor_blocked: {
        Args: { _fingerprint?: string; _ip?: string }
        Returns: boolean
      }
      log_error_event: {
        Args: {
          p_context: Json
          p_error_type: string
          p_fingerprint: string
          p_message: string
          p_severity: string
          p_source_url: string
          p_stack: string
          p_user_agent: string
          p_user_role: string
          p_visitor_profile_id: string
        }
        Returns: string
      }
      log_missing_order_sms_errors: { Args: never; Returns: number }
      log_search: {
        Args: {
          p_query: string
          p_result_count?: number
          p_source?: string
          p_visitor_id?: string
          p_visitor_profile_id?: string
        }
        Returns: undefined
      }
      log_stuck_sms_queue_errors: { Args: never; Returns: number }
      marketing_order_status_counts: {
        Args: { p_districts?: string[]; p_from: string; p_to: string }
        Returns: {
          cnt: number
          status: string
          unique_phones: number
        }[]
      }
      marketing_resolve_order_phones: {
        Args: {
          p_districts?: string[]
          p_from: string
          p_min_orders?: number
          p_min_spend?: number
          p_statuses: string[]
          p_to: string
        }
        Returns: {
          last_order_id: string
          name: string
          phone: string
          total_orders: number
          total_spend: number
        }[]
      }
      match_rag_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      match_watched_visitor: {
        Args: {
          _ip: string
          _phone: string
          _profile_id: string
          _visitor_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_owner_sms: { Args: { _message: string }; Returns: undefined }
      owner_alert_enabled: { Args: { _category: string }; Returns: boolean }
      place_order: {
        Args: {
          p_address: string
          p_alt_phone?: string
          p_customer_name: string
          p_delivery_charge?: number
          p_discount?: number
          p_note?: string
          p_phone: string
          p_total_amount?: number
          p_traffic_source?: string
          p_visitor_id?: string
          p_visitor_profile_id?: string
        }
        Returns: {
          id: string
          order_id: string
        }[]
      }
      purchase_premium_cover: {
        Args: { p_cost: number; p_cover_id: string; p_profile_id: string }
        Returns: Json
      }
      purchase_premium_ring: {
        Args: { p_cost: number; p_profile_id: string; p_ring_id: string }
        Returns: Json
      }
      purchase_premium_theme: {
        Args: { p_cost: number; p_profile_id: string; p_theme_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reject_creator_payout: {
        Args: { _payout_id: string; _reason?: string }
        Returns: Json
      }
      remove_linked_phone_by_token: {
        Args: { p_phone: string; p_session_token: string }
        Returns: Json
      }
      replace_namaskar: { Args: { input: string }; Returns: string }
      set_group_member_role: {
        Args: {
          _actor_profile_id: string
          _group_id: string
          _new_role: string
          _target_profile_id: string
        }
        Returns: Json
      }
      super_delete_social_post: {
        Args: { _post_id: string; _profile_id: string; _session_token: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
