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
      accounts: {
        Row: {
          ai_simulation_enabled: boolean | null
          business_type: string
          created_at: string
          id: string
          menu_theme: string
          name: string
          owner_pin: string | null
          owner_user_id: string
          pix_access_until: string | null
          pix_plan_id: string | null
          plan_id: string | null
          plan_status: string
          trial_ends_at: string | null
        }
        Insert: {
          ai_simulation_enabled?: boolean | null
          business_type?: string
          created_at?: string
          id?: string
          menu_theme?: string
          name: string
          owner_pin?: string | null
          owner_user_id?: string
          pix_access_until?: string | null
          pix_plan_id?: string | null
          plan_id?: string | null
          plan_status?: string
          trial_ends_at?: string | null
        }
        Update: {
          ai_simulation_enabled?: boolean | null
          business_type?: string
          created_at?: string
          id?: string
          menu_theme?: string
          name?: string
          owner_pin?: string | null
          owner_user_id?: string
          pix_access_until?: string | null
          pix_plan_id?: string | null
          plan_id?: string | null
          plan_status?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_pix_plan_id_fkey"
            columns: ["pix_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          store_id: string | null
          supplier_name: string | null
        }
        Insert: {
          account_id: string
          amount?: number
          category?: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          store_id?: string | null
          supplier_name?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          store_id?: string | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          customer_id: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          paid_at: string | null
          sale_id: string | null
          status: string
          store_id: string | null
          total_installments: number | null
        }
        Insert: {
          account_id: string
          amount?: number
          category?: string
          created_at?: string
          customer_id?: string | null
          description: string
          due_date: string
          id?: string
          installment_number?: number | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          store_id?: string | null
          total_installments?: number | null
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          customer_id?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          paid_at?: string | null
          sale_id?: string | null
          status?: string
          store_id?: string | null
          total_installments?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_balances: {
        Row: {
          account_id: string
          created_at: string
          last_monthly_grant_at: string | null
          plan_credits: number
          purchased_credits: number
          total_consumed: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          last_monthly_grant_at?: string | null
          plan_credits?: number
          purchased_credits?: number
          total_consumed?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          last_monthly_grant_at?: string | null
          plan_credits?: number
          purchased_credits?: number
          total_consumed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_packages: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          highlight: boolean
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_purchases: {
        Row: {
          account_id: string
          created_at: string
          credits: number
          id: string
          package_id: string | null
          payment_method: string
          pix_proof_url: string | null
          price_cents: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credits: number
          id?: string
          package_id?: string | null
          payment_method: string
          pix_proof_url?: string | null
          price_cents: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credits?: number
          id?: string
          package_id?: string | null
          payment_method?: string
          pix_proof_url?: string | null
          price_cents?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_transactions: {
        Row: {
          account_id: string
          created_at: string
          delta: number
          id: string
          notes: string | null
          reference_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          delta: number
          id?: string
          notes?: string | null
          reference_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          delta?: number
          id?: string
          notes?: string | null
          reference_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_simulations: {
        Row: {
          account_id: string
          analysis: Json | null
          created_at: string
          customer_id: string | null
          environment_image_url: string
          error_message: string | null
          generated_image_url: string | null
          id: string
          model: string
          product_id: string
          space_height_cm: number | null
          space_width_cm: number | null
          status: string
          store_id: string | null
          suggestions: Json | null
          updated_at: string
          user_id: string
          user_notes: string | null
          variant_id: string | null
        }
        Insert: {
          account_id: string
          analysis?: Json | null
          created_at?: string
          customer_id?: string | null
          environment_image_url: string
          error_message?: string | null
          generated_image_url?: string | null
          id?: string
          model?: string
          product_id: string
          space_height_cm?: number | null
          space_width_cm?: number | null
          status?: string
          store_id?: string | null
          suggestions?: Json | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          analysis?: Json | null
          created_at?: string
          customer_id?: string | null
          environment_image_url?: string
          error_message?: string | null
          generated_image_url?: string | null
          id?: string
          model?: string
          product_id?: string
          space_height_cm?: number | null
          space_width_cm?: number | null
          status?: string
          store_id?: string | null
          suggestions?: Json | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_simulations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_simulations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_simulations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_simulations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_simulations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string
          created_at: string
          id: string
          is_active: boolean
          marketplace_ids: string[] | null
          refresh_token: string
          seller_id: string | null
          store_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          marketplace_ids?: string[] | null
          refresh_token: string
          seller_id?: string | null
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          marketplace_ids?: string[] | null
          refresh_token?: string
          seller_id?: string | null
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amazon_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_global_credentials: {
        Row: {
          app_id: string | null
          aws_region: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          lwa_client_id: string
          lwa_client_secret: string
          marketplace_id: string
          updated_at: string
        }
        Insert: {
          app_id?: string | null
          aws_region?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          lwa_client_id: string
          lwa_client_secret: string
          marketplace_id?: string
          updated_at?: string
        }
        Update: {
          app_id?: string | null
          aws_region?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          lwa_client_id?: string
          lwa_client_secret?: string
          marketplace_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          environment: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          account_id: string
          api_key_id: string | null
          created_at: string
          environment: string
          error_code: string | null
          id: string
          ip: string | null
          latency_ms: number
          method: string
          path: string
          query_params: Json | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          account_id: string
          api_key_id?: string | null
          created_at?: string
          environment?: string
          error_code?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method: string
          path: string
          query_params?: Json | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          api_key_id?: string | null
          created_at?: string
          environment?: string
          error_code?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method?: string
          path?: string
          query_params?: Json | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      assemblers: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          store_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          store_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assemblers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      assemblies: {
        Row: {
          account_id: string
          assembler_id: string | null
          created_at: string
          id: string
          notes: string | null
          sale_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["assembly_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assembler_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sale_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["assembly_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assembler_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sale_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["assembly_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assemblies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_assembler_id_fkey"
            columns: ["assembler_id"]
            isOneToOne: false
            referencedRelation: "assemblers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_campaign_settings: {
        Row: {
          account_id: string
          coupon_code: string | null
          coupon_description: string | null
          coupon_discount_type: string
          coupon_discount_value: number
          coupon_enabled: boolean
          coupon_prefix: string | null
          coupon_valid_days: number
          created_at: string
          email_html_template: string | null
          email_message: string
          email_subject: string
          enabled: boolean
          from_name: string | null
          id: string
          reply_to: string | null
          send_email: boolean
          send_hour: number
          store_id: string
          template_mode: string
          updated_at: string
        }
        Insert: {
          account_id: string
          coupon_code?: string | null
          coupon_description?: string | null
          coupon_discount_type?: string
          coupon_discount_value?: number
          coupon_enabled?: boolean
          coupon_prefix?: string | null
          coupon_valid_days?: number
          created_at?: string
          email_html_template?: string | null
          email_message?: string
          email_subject?: string
          enabled?: boolean
          from_name?: string | null
          id?: string
          reply_to?: string | null
          send_email?: boolean
          send_hour?: number
          store_id: string
          template_mode?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          coupon_code?: string | null
          coupon_description?: string | null
          coupon_discount_type?: string
          coupon_discount_value?: number
          coupon_enabled?: boolean
          coupon_prefix?: string | null
          coupon_valid_days?: number
          created_at?: string
          email_html_template?: string | null
          email_message?: string
          email_subject?: string
          enabled?: boolean
          from_name?: string | null
          id?: string
          reply_to?: string | null
          send_email?: boolean
          send_hour?: number
          store_id?: string
          template_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      birthday_coupons: {
        Row: {
          account_id: string
          code: string
          created_at: string
          customer_id: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          redeemed_sale_id: string | null
          source: string
          status: string
          store_id: string
          valid_until: string
        }
        Insert: {
          account_id: string
          code: string
          created_at?: string
          customer_id: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_sale_id?: string | null
          source?: string
          status?: string
          store_id: string
          valid_until: string
        }
        Update: {
          account_id?: string
          code?: string
          created_at?: string
          customer_id?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          redeemed_sale_id?: string | null
          source?: string
          status?: string
          store_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      birthday_send_log: {
        Row: {
          account_id: string
          channel: string
          created_at: string
          customer_id: string
          error: string | null
          id: string
          sent_year: number
          status: string
          store_id: string
        }
        Insert: {
          account_id: string
          channel?: string
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          sent_year: number
          status?: string
          store_id: string
        }
        Update: {
          account_id?: string
          channel?: string
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          sent_year?: number
          status?: string
          store_id?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          account_id: string
          amount: number
          authorized_by: string | null
          cash_register_id: string
          created_at: string
          created_by: string
          id: string
          reason: string | null
          store_id: string
          type: string
        }
        Insert: {
          account_id: string
          amount?: number
          authorized_by?: string | null
          cash_register_id: string
          created_at?: string
          created_by: string
          id?: string
          reason?: string | null
          store_id: string
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          authorized_by?: string | null
          cash_register_id?: string
          created_at?: string
          created_by?: string
          id?: string
          reason?: string | null
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          account_id: string
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          store_id: string
          total_card: number | null
          total_cash: number | null
          total_pix: number | null
          total_sales: number | null
        }
        Insert: {
          account_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: string
          store_id: string
          total_card?: number | null
          total_cash?: number | null
          total_pix?: number | null
          total_sales?: number | null
        }
        Update: {
          account_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          store_id?: string
          total_card?: number | null
          total_cash?: number | null
          total_pix?: number | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          account_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_pushname: string | null
          escalated_at: string | null
          escalation_reason: string | null
          id: string
          is_ai_active: boolean
          is_typing: boolean
          last_bot_phrases: Json
          last_message_at: string | null
          phone: string
          profile_fetched_at: string | null
          profile_pic_url: string | null
          sale_id: string | null
          session_state: Json
          status: string
          store_id: string
          typing_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_pushname?: string | null
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          is_ai_active?: boolean
          is_typing?: boolean
          last_bot_phrases?: Json
          last_message_at?: string | null
          phone: string
          profile_fetched_at?: string | null
          profile_pic_url?: string | null
          sale_id?: string | null
          session_state?: Json
          status?: string
          store_id: string
          typing_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_pushname?: string | null
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          is_ai_active?: boolean
          is_typing?: boolean
          last_bot_phrases?: Json
          last_message_at?: string | null
          phone?: string
          profile_fetched_at?: string | null
          profile_pic_url?: string | null
          sale_id?: string | null
          session_state?: Json
          status?: string
          store_id?: string
          typing_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          is_ai_generated: boolean
          media_url: string | null
          message_type: string
          status: string
          z_api_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          is_ai_generated?: boolean
          media_url?: string | null
          message_type?: string
          status?: string
          z_api_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          is_ai_generated?: boolean
          media_url?: string | null
          message_type?: string
          status?: string
          z_api_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_settings: {
        Row: {
          account_id: string
          ai_instructions: string | null
          away_message: string | null
          business_days: number[] | null
          business_hours_end: string | null
          business_hours_start: string | null
          business_info: string | null
          created_at: string
          faq: string | null
          forbidden_topics: string | null
          greeting_message: string | null
          id: string
          is_active: boolean
          response_examples: string | null
          store_id: string
          tone: string | null
          tracking_message_template: string | null
          updated_at: string
          z_api_client_token: string | null
          z_api_instance_id: string | null
          z_api_instance_token: string | null
        }
        Insert: {
          account_id: string
          ai_instructions?: string | null
          away_message?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_info?: string | null
          created_at?: string
          faq?: string | null
          forbidden_topics?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          response_examples?: string | null
          store_id: string
          tone?: string | null
          tracking_message_template?: string | null
          updated_at?: string
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_instance_token?: string | null
        }
        Update: {
          account_id?: string
          ai_instructions?: string | null
          away_message?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_info?: string | null
          created_at?: string
          faq?: string | null
          forbidden_topics?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          response_examples?: string | null
          store_id?: string
          tone?: string | null
          tracking_message_template?: string | null
          updated_at?: string
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_instance_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_cycles: {
        Row: {
          account_id: string
          created_at: string
          ended_at: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          seller_user_id: string
          started_at: string
          status: string
          total_commission: number
        }
        Insert: {
          account_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          seller_user_id: string
          started_at?: string
          status?: string
          total_commission?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          seller_user_id?: string
          started_at?: string
          status?: string
          total_commission?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_cycles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          max_value: number | null
          min_value: number
          percent: number
          seller_user_id: string
          tier_type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number
          percent?: number
          seller_user_id: string
          tier_type?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number
          percent?: number
          seller_user_id?: string
          tier_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_tiers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          created_at: string
          id: string
          percent: number
          sale_id: string
          seller_user_id: string
          status: Database["public"]["Enums"]["commission_status"]
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          percent: number
          sale_id: string
          seller_user_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          percent?: number
          sale_id?: string
          seller_user_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_override_requests: {
        Row: {
          account_id: string
          approved_at: string | null
          approved_by: string | null
          authorization_type: string | null
          authorized_amount: number | null
          created_at: string
          current_limit: number
          customer_id: string
          denied_at: string | null
          denied_by: string | null
          deny_reason: string | null
          excess_amount: number
          id: string
          requested_at: string
          requested_by: string
          sale_amount: number
          sale_id: string | null
          status: string
          store_id: string | null
          used_balance: number
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          approved_by?: string | null
          authorization_type?: string | null
          authorized_amount?: number | null
          created_at?: string
          current_limit?: number
          customer_id: string
          denied_at?: string | null
          denied_by?: string | null
          deny_reason?: string | null
          excess_amount?: number
          id?: string
          requested_at?: string
          requested_by: string
          sale_amount?: number
          sale_id?: string | null
          status?: string
          store_id?: string | null
          used_balance?: number
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          approved_by?: string | null
          authorization_type?: string | null
          authorized_amount?: number | null
          created_at?: string
          current_limit?: number
          customer_id?: string
          denied_at?: string | null
          denied_by?: string | null
          deny_reason?: string | null
          excess_amount?: number
          id?: string
          requested_at?: string
          requested_by?: string
          sale_amount?: number
          sale_id?: string | null
          status?: string
          store_id?: string | null
          used_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_override_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_override_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_override_requests_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_override_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ai_profiles: {
        Row: {
          account_id: string
          avg_ticket: number | null
          communication_style: string | null
          created_at: string
          customer_id: string | null
          disliked_items: string[] | null
          display_name: string | null
          frequent_products: string[] | null
          id: string
          insights_json: Json
          last_interaction_at: string | null
          notes_summary: string | null
          phone: string
          preferred_brands: string[] | null
          preferred_categories: string[] | null
          preferred_greeting: string | null
          total_interactions: number
          total_purchases: number
          updated_at: string
        }
        Insert: {
          account_id: string
          avg_ticket?: number | null
          communication_style?: string | null
          created_at?: string
          customer_id?: string | null
          disliked_items?: string[] | null
          display_name?: string | null
          frequent_products?: string[] | null
          id?: string
          insights_json?: Json
          last_interaction_at?: string | null
          notes_summary?: string | null
          phone: string
          preferred_brands?: string[] | null
          preferred_categories?: string[] | null
          preferred_greeting?: string | null
          total_interactions?: number
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          avg_ticket?: number | null
          communication_style?: string | null
          created_at?: string
          customer_id?: string | null
          disliked_items?: string[] | null
          display_name?: string | null
          frequent_products?: string[] | null
          id?: string
          insights_json?: Json
          last_interaction_at?: string | null
          notes_summary?: string | null
          phone?: string
          preferred_brands?: string[] | null
          preferred_categories?: string[] | null
          preferred_greeting?: string | null
          total_interactions?: number
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_returns: {
        Row: {
          account_id: string
          attachments: Json
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          photos: Json | null
          reason: string
          requested_at: string
          resolution_notes: string | null
          resolved_at: string | null
          return_note_id: string | null
          return_type: string
          sale_id: string | null
          status: string
          stock_refunded: boolean
          store_credit_id: string | null
          store_id: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          account_id: string
          attachments?: Json
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          photos?: Json | null
          reason: string
          requested_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          return_note_id?: string | null
          return_type?: string
          sale_id?: string | null
          status?: string
          stock_refunded?: boolean
          store_credit_id?: string | null
          store_id: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          account_id?: string
          attachments?: Json
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          photos?: Json | null
          reason?: string
          requested_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          return_note_id?: string | null
          return_type?: string
          sale_id?: string | null
          status?: string
          stock_refunded?: boolean
          store_credit_id?: string | null
          store_id?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_returns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_return_note_id_fkey"
            columns: ["return_note_id"]
            isOneToOne: false
            referencedRelation: "return_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_store_credit_id_fkey"
            columns: ["store_credit_id"]
            isOneToOne: false
            referencedRelation: "store_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_id: string
          address_json: Json | null
          birth_date: string | null
          created_at: string
          credit_authorized: boolean
          credit_limit: number
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          address_json?: Json | null
          birth_date?: string | null
          created_at?: string
          credit_authorized?: boolean
          credit_limit?: number
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          birth_date?: string | null
          created_at?: string
          credit_authorized?: boolean
          credit_limit?: number
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          account_id: string
          address_json: Json | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          driver_id: string | null
          eta_at: string | null
          eta_minutes: number | null
          id: string
          notes: string | null
          sale_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          address_json?: Json | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          driver_id?: string | null
          eta_at?: string | null
          eta_minutes?: number | null
          id?: string
          notes?: string | null
          sale_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          driver_id?: string | null
          eta_at?: string | null
          eta_minutes?: number | null
          id?: string
          notes?: string | null
          sale_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          rntrc: string | null
          store_id: string | null
          vehicle_plate: string | null
          vehicle_tara: number | null
          vehicle_uf: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          rntrc?: string | null
          store_id?: string | null
          vehicle_plate?: string | null
          vehicle_tara?: number | null
          vehicle_uf?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          rntrc?: string | null
          store_id?: string | null
          vehicle_plate?: string | null
          vehicle_tara?: number | null
          vehicle_uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          account_id: string
          audience: string
          body: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          headline: string
          highlight_old_price: string | null
          highlight_price: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_sent_at: string | null
          name: string
          store_id: string | null
          subject: string
          total_sent: number
          updated_at: string
        }
        Insert: {
          account_id: string
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          headline: string
          highlight_old_price?: string | null
          highlight_price?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_sent_at?: string | null
          name: string
          store_id?: string | null
          subject: string
          total_sent?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          headline?: string
          highlight_old_price?: string | null
          highlight_price?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_sent_at?: string | null
          name?: string
          store_id?: string | null
          subject?: string
          total_sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_logs: {
        Row: {
          account_id: string
          campaign_id: string | null
          created_at: string
          customer_id: string | null
          error: string | null
          id: string
          kind: string
          recipient_email: string
          resend_id: string | null
          sale_id: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          account_id: string
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          kind: string
          recipient_email: string
          resend_id?: string | null
          sale_id?: string | null
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          account_id?: string
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          recipient_email?: string
          resend_id?: string | null
          sale_id?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          type: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
        }
        Relationships: []
      }
      fiscal_corrections: {
        Row: {
          account_id: string
          correcao_text: string
          created_at: string
          error_message: string | null
          fiscal_document_id: string
          id: string
          pdf_url: string | null
          protocolo: string | null
          provider_ref: string | null
          response_json: Json | null
          sequencia: number
          status: string
          store_id: string
          updated_at: string
          user_id: string | null
          xml_url: string | null
        }
        Insert: {
          account_id: string
          correcao_text: string
          created_at?: string
          error_message?: string | null
          fiscal_document_id: string
          id?: string
          pdf_url?: string | null
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          sequencia: number
          status?: string
          store_id: string
          updated_at?: string
          user_id?: string | null
          xml_url?: string | null
        }
        Update: {
          account_id?: string
          correcao_text?: string
          created_at?: string
          error_message?: string | null
          fiscal_document_id?: string
          id?: string
          pdf_url?: string | null
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          sequencia?: number
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_corrections_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          contingency_justification: string | null
          contingency_mode: boolean
          created_at: string
          id: string
          last_retry_at: string | null
          nfe_number: string | null
          pdf_url: string | null
          provider: string
          provider_id: string | null
          purpose: string
          ref_fiscal_document_id: string | null
          retry_count: number
          return_note_id: string | null
          sale_id: string
          status: string
          store_id: string
          transmitted_at: string | null
          type: Database["public"]["Enums"]["fiscal_doc_type"]
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          contingency_justification?: string | null
          contingency_mode?: boolean
          created_at?: string
          id?: string
          last_retry_at?: string | null
          nfe_number?: string | null
          pdf_url?: string | null
          provider?: string
          provider_id?: string | null
          purpose?: string
          ref_fiscal_document_id?: string | null
          retry_count?: number
          return_note_id?: string | null
          sale_id: string
          status?: string
          store_id: string
          transmitted_at?: string | null
          type: Database["public"]["Enums"]["fiscal_doc_type"]
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          contingency_justification?: string | null
          contingency_mode?: boolean
          created_at?: string
          id?: string
          last_retry_at?: string | null
          nfe_number?: string | null
          pdf_url?: string | null
          provider?: string
          provider_id?: string | null
          purpose?: string
          ref_fiscal_document_id?: string | null
          retry_count?: number
          return_note_id?: string | null
          sale_id?: string
          status?: string
          store_id?: string
          transmitted_at?: string | null
          type?: Database["public"]["Enums"]["fiscal_doc_type"]
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_ref_fiscal_document_id_fkey"
            columns: ["ref_fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_return_note_id_fkey"
            columns: ["return_note_id"]
            isOneToOne: false
            referencedRelation: "return_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_entries: {
        Row: {
          access_key: string | null
          account_id: string
          canceled_at: string | null
          canceled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          id: string
          issue_date: string | null
          nfe_number: string | null
          nfe_series: string | null
          notes: string | null
          pdf_path: string | null
          status: string
          store_id: string
          supplier_id: string | null
          total_discount: number
          total_freight: number
          total_nfe: number
          total_products: number
          xml_path: string | null
        }
        Insert: {
          access_key?: string | null
          account_id: string
          canceled_at?: string | null
          canceled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          issue_date?: string | null
          nfe_number?: string | null
          nfe_series?: string | null
          notes?: string | null
          pdf_path?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
          total_discount?: number
          total_freight?: number
          total_nfe?: number
          total_products?: number
          xml_path?: string | null
        }
        Update: {
          access_key?: string | null
          account_id?: string
          canceled_at?: string | null
          canceled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          issue_date?: string | null
          nfe_number?: string | null
          nfe_series?: string | null
          notes?: string | null
          pdf_path?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          total_discount?: number
          total_freight?: number
          total_nfe?: number
          total_products?: number
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_entry_items: {
        Row: {
          cfop: string | null
          created_product: boolean
          description: string
          fiscal_entry_id: string
          id: string
          matched: boolean
          ncm: string | null
          product_id: string | null
          quantity: number
          total_line: number
          unit: string
          unit_price: number
          xml_code: string | null
        }
        Insert: {
          cfop?: string | null
          created_product?: boolean
          description: string
          fiscal_entry_id: string
          id?: string
          matched?: boolean
          ncm?: string | null
          product_id?: string | null
          quantity?: number
          total_line?: number
          unit?: string
          unit_price?: number
          xml_code?: string | null
        }
        Update: {
          cfop?: string | null
          created_product?: boolean
          description?: string
          fiscal_entry_id?: string
          id?: string
          matched?: boolean
          ncm?: string | null
          product_id?: string | null
          quantity?: number
          total_line?: number
          unit?: string
          unit_price?: number
          xml_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_entry_items_fiscal_entry_id_fkey"
            columns: ["fiscal_entry_id"]
            isOneToOne: false
            referencedRelation: "fiscal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_entry_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invalidations: {
        Row: {
          account_id: string
          created_at: string
          error_message: string | null
          id: string
          justificativa: string
          modelo: string
          numero_final: number
          numero_inicial: number
          protocolo: string | null
          provider_ref: string | null
          response_json: Json | null
          serie: number
          status: string
          store_id: string
          updated_at: string
          user_id: string | null
          xml_url: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          justificativa: string
          modelo: string
          numero_final: number
          numero_inicial: number
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          serie: number
          status?: string
          store_id: string
          updated_at?: string
          user_id?: string | null
          xml_url?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          justificativa?: string
          modelo?: string
          numero_final?: number
          numero_inicial?: number
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          serie?: number
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string | null
          xml_url?: string | null
        }
        Relationships: []
      }
      fiscal_xml_backups: {
        Row: {
          account_id: string
          backed_up_at: string
          chave_nfe: string
          fiscal_document_id: string | null
          id: string
          size_bytes: number | null
          storage_path: string
          store_id: string
        }
        Insert: {
          account_id: string
          backed_up_at?: string
          chave_nfe: string
          fiscal_document_id?: string | null
          id?: string
          size_bytes?: number | null
          storage_path: string
          store_id: string
        }
        Update: {
          account_id?: string
          backed_up_at?: string
          chave_nfe?: string
          fiscal_document_id?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_xml_backups_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sales: {
        Row: {
          account_id: string
          cart_json: Json
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          notes: string
          seller_user_id: string
          store_id: string
        }
        Insert: {
          account_id: string
          cart_json?: Json
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string
          seller_user_id: string
          store_id: string
        }
        Update: {
          account_id?: string
          cart_json?: Json
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string
          seller_user_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_sales_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_errors: {
        Row: {
          id: string
          job_id: string
          message: string
          row_data_json: Json | null
          row_number: number
        }
        Insert: {
          id?: string
          job_id: string
          message: string
          row_data_json?: Json | null
          row_number: number
        }
        Update: {
          id?: string
          job_id?: string
          message?: string
          row_data_json?: Json | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_job_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          account_id: string
          created_at: string
          error_rows: number
          id: string
          status: Database["public"]["Enums"]["import_job_status"]
          success_rows: number
          total_rows: number
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          error_rows?: number
          id?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          success_rows?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error_rows?: number
          id?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          success_rows?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          id: string
          key_name: string
          key_value: string
          notes: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_name: string
          key_value: string
          notes?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_name?: string
          key_value?: string
          notes?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          expiration_date: string | null
          id: string
          min_qty: number
          product_id: string
          qty_on_hand: number
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          expiration_date?: string | null
          id?: string
          min_qty?: number
          product_id: string
          qty_on_hand?: number
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          expiration_date?: string | null
          id?: string
          min_qty?: number
          product_id?: string
          qty_on_hand?: number
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      magalu_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string
          created_at: string
          id: string
          is_active: boolean
          refresh_token: string
          seller_id: string | null
          store_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          refresh_token: string
          seller_id?: string | null
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          refresh_token?: string
          seller_id?: string | null
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magalu_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magalu_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      magalu_global_credentials: {
        Row: {
          api_base_url: string
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          scope: string | null
          updated_at: string
        }
        Insert: {
          api_base_url?: string
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          scope?: string | null
          updated_at?: string
        }
        Update: {
          api_base_url?: string
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mdfe_documents: {
        Row: {
          account_id: string
          cancel_justificativa: string | null
          cancelado_em: string | null
          chave: string | null
          created_at: string
          documentos_vinculados: Json | null
          encerrado_em: string | null
          error_message: string | null
          id: string
          modelo: string
          motorista_cpf: string
          motorista_nome: string
          municipio_carregamento: string | null
          municipio_descarregamento: string | null
          numero: number | null
          origem_id: string | null
          origem_tipo: string | null
          pdf_url: string | null
          peso_total: number | null
          protocolo: string | null
          provider_ref: string | null
          response_json: Json | null
          serie: number
          status: string
          store_id: string
          uf_carregamento: string
          uf_descarregamento: string
          updated_at: string
          user_id: string | null
          valor_total: number | null
          veiculo_placa: string
          veiculo_rntrc: string | null
          veiculo_tara: number | null
          veiculo_uf: string | null
          xml_url: string | null
        }
        Insert: {
          account_id: string
          cancel_justificativa?: string | null
          cancelado_em?: string | null
          chave?: string | null
          created_at?: string
          documentos_vinculados?: Json | null
          encerrado_em?: string | null
          error_message?: string | null
          id?: string
          modelo?: string
          motorista_cpf: string
          motorista_nome: string
          municipio_carregamento?: string | null
          municipio_descarregamento?: string | null
          numero?: number | null
          origem_id?: string | null
          origem_tipo?: string | null
          pdf_url?: string | null
          peso_total?: number | null
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          serie?: number
          status?: string
          store_id: string
          uf_carregamento: string
          uf_descarregamento: string
          updated_at?: string
          user_id?: string | null
          valor_total?: number | null
          veiculo_placa: string
          veiculo_rntrc?: string | null
          veiculo_tara?: number | null
          veiculo_uf?: string | null
          xml_url?: string | null
        }
        Update: {
          account_id?: string
          cancel_justificativa?: string | null
          cancelado_em?: string | null
          chave?: string | null
          created_at?: string
          documentos_vinculados?: Json | null
          encerrado_em?: string | null
          error_message?: string | null
          id?: string
          modelo?: string
          motorista_cpf?: string
          motorista_nome?: string
          municipio_carregamento?: string | null
          municipio_descarregamento?: string | null
          numero?: number | null
          origem_id?: string | null
          origem_tipo?: string | null
          pdf_url?: string | null
          peso_total?: number | null
          protocolo?: string | null
          provider_ref?: string | null
          response_json?: Json | null
          serie?: number
          status?: string
          store_id?: string
          uf_carregamento?: string
          uf_descarregamento?: string
          updated_at?: string
          user_id?: string | null
          valor_total?: number | null
          veiculo_placa?: string
          veiculo_rntrc?: string | null
          veiculo_tara?: number | null
          veiculo_uf?: string | null
          xml_url?: string | null
        }
        Relationships: []
      }
      melhor_envio_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string
          created_at: string
          default_height_cm: number | null
          default_length_cm: number | null
          default_weight_grams: number | null
          default_width_cm: number | null
          enabled_carriers: Json
          id: string
          is_active: boolean
          markup_percent: number | null
          origin_zipcode: string | null
          refresh_token: string
          store_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string
          created_at?: string
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          enabled_carriers?: Json
          id?: string
          is_active?: boolean
          markup_percent?: number | null
          origin_zipcode?: string | null
          refresh_token: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string
          created_at?: string
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          enabled_carriers?: Json
          id?: string
          is_active?: boolean
          markup_percent?: number | null
          origin_zipcode?: string | null
          refresh_token?: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "melhor_envio_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "melhor_envio_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      melhor_envio_global_credentials: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      meli_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string | null
          connected_by: string | null
          created_at: string
          id: string
          is_mock: boolean
          last_sync_at: string | null
          meli_user_id: string | null
          nickname: string | null
          refresh_token: string | null
          site_id: string
          status: string
          store_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_mock?: boolean
          last_sync_at?: string | null
          meli_user_id?: string | null
          nickname?: string | null
          refresh_token?: string | null
          site_id?: string
          status?: string
          store_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_mock?: boolean
          last_sync_at?: string | null
          meli_user_id?: string | null
          nickname?: string | null
          refresh_token?: string | null
          site_id?: string
          status?: string
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_orders: {
        Row: {
          account_id: string
          buyer_nickname: string | null
          connection_id: string
          created_at: string
          id: string
          meli_order_id: string
          payload_json: Json | null
          received_at: string
          sale_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          buyer_nickname?: string | null
          connection_id: string
          created_at?: string
          id?: string
          meli_order_id: string
          payload_json?: Json | null
          received_at?: string
          sale_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          buyer_nickname?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          meli_order_id?: string
          payload_json?: Json | null
          received_at?: string
          sale_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meli_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_product_links: {
        Row: {
          account_id: string
          connection_id: string
          created_at: string
          created_by: string | null
          id: string
          include_variants: boolean
          last_synced_at: string | null
          meli_item_id: string | null
          meli_price: number | null
          product_id: string
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          connection_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_variants?: boolean
          last_synced_at?: string | null
          meli_item_id?: string | null
          meli_price?: number | null
          product_id: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          connection_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_variants?: boolean
          last_synced_at?: string | null
          meli_item_id?: string | null
          meli_price?: number | null
          product_id?: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_product_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_product_links_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meli_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string | null
          connected_by: string | null
          created_at: string
          credit_fee_percent: number
          debit_fee_percent: number
          enabled_methods: Json
          environment: string
          id: string
          last_error: string | null
          mp_user_id: string | null
          nickname: string | null
          point_device_id: string | null
          point_device_name: string | null
          public_key: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credit_fee_percent?: number
          debit_fee_percent?: number
          enabled_methods?: Json
          environment?: string
          id?: string
          last_error?: string | null
          mp_user_id?: string | null
          nickname?: string | null
          point_device_id?: string | null
          point_device_name?: string | null
          public_key?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          credit_fee_percent?: number
          debit_fee_percent?: number
          enabled_methods?: Json
          environment?: string
          id?: string
          last_error?: string | null
          mp_user_id?: string | null
          nickname?: string | null
          point_device_id?: string | null
          point_device_name?: string | null
          public_key?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mp_payments: {
        Row: {
          account_id: string
          amount: number
          approved_at: string | null
          card_brand: string | null
          connection_id: string | null
          created_at: string
          external_reference: string | null
          id: string
          installments: number | null
          method: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          payer_document: string | null
          payer_email: string | null
          pix_copy_paste: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          point_device_id: string | null
          raw_payload: Json | null
          sale_id: string | null
          source: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          approved_at?: string | null
          card_brand?: string | null
          connection_id?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          installments?: number | null
          method: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_document?: string | null
          payer_email?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          point_device_id?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          source?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          approved_at?: string | null
          card_brand?: string | null
          connection_id?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          installments?: number | null
          method?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_document?: string | null
          payer_email?: string | null
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          point_device_id?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          source?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_payments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "mp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_destination_manifest: {
        Row: {
          account_id: string
          chave_nfe: string
          cnpj_emitente: string | null
          created_at: string
          data_emissao: string | null
          error_message: string | null
          id: string
          manifested_at: string | null
          nome_emitente: string | null
          numero_nfe: string | null
          protocolo: string | null
          response_json: Json | null
          serie_nfe: string | null
          status: string
          store_id: string
          tipo_manifestacao: string | null
          updated_at: string
          user_id: string | null
          valor_nfe: number | null
        }
        Insert: {
          account_id: string
          chave_nfe: string
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          error_message?: string | null
          id?: string
          manifested_at?: string | null
          nome_emitente?: string | null
          numero_nfe?: string | null
          protocolo?: string | null
          response_json?: Json | null
          serie_nfe?: string | null
          status?: string
          store_id: string
          tipo_manifestacao?: string | null
          updated_at?: string
          user_id?: string | null
          valor_nfe?: number | null
        }
        Update: {
          account_id?: string
          chave_nfe?: string
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          error_message?: string | null
          id?: string
          manifested_at?: string | null
          nome_emitente?: string | null
          numero_nfe?: string | null
          protocolo?: string | null
          response_json?: Json | null
          serie_nfe?: string | null
          status?: string
          store_id?: string
          tipo_manifestacao?: string | null
          updated_at?: string
          user_id?: string | null
          valor_nfe?: number | null
        }
        Relationships: []
      }
      nfeio_settings: {
        Row: {
          api_key: string
          block_sale_without_fiscal_data: boolean
          company_id: string | null
          created_at: string
          environment: Database["public"]["Enums"]["nfeio_environment"]
          id: string
          is_active: boolean
          nfse_aliquota: number
          nfse_cnae: string | null
          nfse_enabled: boolean
          nfse_iss_retido: boolean
          nfse_item_description: string | null
          nfse_service_code: string | null
          store_id: string
          webhook_secret: string | null
        }
        Insert: {
          api_key: string
          block_sale_without_fiscal_data?: boolean
          company_id?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["nfeio_environment"]
          id?: string
          is_active?: boolean
          nfse_aliquota?: number
          nfse_cnae?: string | null
          nfse_enabled?: boolean
          nfse_iss_retido?: boolean
          nfse_item_description?: string | null
          nfse_service_code?: string | null
          store_id: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string
          block_sale_without_fiscal_data?: boolean
          company_id?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["nfeio_environment"]
          id?: string
          is_active?: boolean
          nfse_aliquota?: number
          nfse_cnae?: string | null
          nfse_enabled?: boolean
          nfse_iss_retido?: boolean
          nfse_item_description?: string | null
          nfse_service_code?: string | null
          store_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfeio_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          brand: string | null
          card_fee_percent: number
          card_fee_value: number
          card_type: Database["public"]["Enums"]["card_type"] | null
          created_at: string
          id: string
          installments: number | null
          method: Database["public"]["Enums"]["payment_method"]
          mp_payment_ref: string | null
          notes: string | null
          paid_value: number
          sale_id: string
        }
        Insert: {
          brand?: string | null
          card_fee_percent?: number
          card_fee_value?: number
          card_type?: Database["public"]["Enums"]["card_type"] | null
          created_at?: string
          id?: string
          installments?: number | null
          method: Database["public"]["Enums"]["payment_method"]
          mp_payment_ref?: string | null
          notes?: string | null
          paid_value?: number
          sale_id: string
        }
        Update: {
          brand?: string | null
          card_fee_percent?: number
          card_fee_value?: number
          card_type?: Database["public"]["Enums"]["card_type"] | null
          created_at?: string
          id?: string
          installments?: number | null
          method?: Database["public"]["Enums"]["payment_method"]
          mp_payment_ref?: string | null
          notes?: string | null
          paid_value?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_items: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          picked_at: string | null
          picking_order_id: string
          product_id: string | null
          product_name: string
          qty_picked: number
          qty_required: number
          sku: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          picked_at?: string | null
          picking_order_id: string
          product_id?: string | null
          product_name: string
          qty_picked?: number
          qty_required?: number
          sku?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          picked_at?: string | null
          picking_order_id?: string
          product_id?: string | null
          product_name?: string
          qty_picked?: number
          qty_required?: number
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_items_picking_order_id_fkey"
            columns: ["picking_order_id"]
            isOneToOne: false
            referencedRelation: "picking_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_orders: {
        Row: {
          account_id: string
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          picker_user_id: string | null
          public_token: string | null
          sale_id: string | null
          shipping_label_url: string | null
          shipping_provider: string | null
          started_at: string | null
          status: string
          store_id: string
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          picker_user_id?: string | null
          public_token?: string | null
          sale_id?: string | null
          shipping_label_url?: string | null
          shipping_provider?: string | null
          started_at?: string | null
          status?: string
          store_id: string
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          picker_user_id?: string | null
          public_token?: string | null
          sale_id?: string | null
          shipping_label_url?: string | null
          shipping_provider?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_payment_requests: {
        Row: {
          account_id: string
          activated_until: string | null
          amount: number
          billing_cycle: string
          created_at: string
          id: string
          notes: string | null
          plan_id: string
          proof_url: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          support_ticket_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          activated_until?: string | null
          amount: number
          billing_cycle?: string
          created_at?: string
          id?: string
          notes?: string | null
          plan_id: string
          proof_url?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          support_ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          activated_until?: string | null
          amount?: number
          billing_cycle?: string
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          proof_url?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          support_ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payment_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_payment_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_payment_requests_support_ticket_id_fkey"
            columns: ["support_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ai_credits_monthly: number
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_featured: boolean
          landing_cta_label: string | null
          landing_highlights: string[] | null
          landing_subtitle: string | null
          max_stores: number
          max_users: number
          name: string
          price: number
          slug: string
          sort_order: number
        }
        Insert: {
          ai_credits_monthly?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          landing_cta_label?: string | null
          landing_highlights?: string[] | null
          landing_subtitle?: string | null
          max_stores?: number
          max_users?: number
          name: string
          price?: number
          slug: string
          sort_order?: number
        }
        Update: {
          ai_credits_monthly?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          landing_cta_label?: string | null
          landing_highlights?: string[] | null
          landing_subtitle?: string | null
          max_stores?: number
          max_users?: number
          name?: string
          price?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_expiration_dates: {
        Row: {
          account_id: string
          batch_label: string | null
          created_at: string
          expiration_date: string
          fiscal_entry_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          store_id: string
        }
        Insert: {
          account_id: string
          batch_label?: string | null
          created_at?: string
          expiration_date: string
          fiscal_entry_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          store_id: string
        }
        Update: {
          account_id?: string
          batch_label?: string | null
          created_at?: string
          expiration_date?: string
          fiscal_entry_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_expiration_dates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_expiration_dates_fiscal_entry_id_fkey"
            columns: ["fiscal_entry_id"]
            isOneToOne: false
            referencedRelation: "fiscal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_expiration_dates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_expiration_dates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_presentations: {
        Row: {
          conversion_factor: number
          created_at: string
          gtin: string | null
          id: string
          is_active: boolean
          is_purchase: boolean
          is_sale: boolean
          name: string
          price: number | null
          product_id: string
          purchase_unit_code: string | null
        }
        Insert: {
          conversion_factor?: number
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          is_purchase?: boolean
          is_sale?: boolean
          name: string
          price?: number | null
          product_id: string
          purchase_unit_code?: string | null
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          is_purchase?: boolean
          is_sale?: boolean
          name?: string
          price?: number | null
          product_id?: string
          purchase_unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_presentations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          min_qty: number
          product_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          min_qty?: number
          product_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          min_qty?: number
          product_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          sort_order: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          cost: number
          created_at: string
          gtin: string | null
          id: string
          is_active: boolean
          price: number
          product_id: string
          sku: string | null
        }
        Insert: {
          attributes?: Json
          cost?: number
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          price?: number
          product_id: string
          sku?: string | null
        }
        Update: {
          attributes?: Json
          cost?: number
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          price?: number
          product_id?: string
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string
          ai_training: string | null
          aliq_cofins: number | null
          aliq_icms: number | null
          aliq_ipi: number | null
          aliq_pis: number | null
          brand: string | null
          category: string | null
          cest: string | null
          cfop_default: string | null
          cost_default: number
          created_at: string
          csosn: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          description: string | null
          description_long: string | null
          embedding: string | null
          embedding_text: string | null
          embedding_updated_at: string | null
          gtin: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          ncm: string | null
          origem_icms: string | null
          price_default: number
          product_group: string | null
          promo_ends_at: string | null
          promo_price: number | null
          promo_starts_at: string | null
          sku: string | null
          subcategory: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
          variant_options: Json | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          account_id: string
          ai_training?: string | null
          aliq_cofins?: number | null
          aliq_icms?: number | null
          aliq_ipi?: number | null
          aliq_pis?: number | null
          brand?: string | null
          category?: string | null
          cest?: string | null
          cfop_default?: string | null
          cost_default?: number
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          description?: string | null
          description_long?: string | null
          embedding?: string | null
          embedding_text?: string | null
          embedding_updated_at?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          ncm?: string | null
          origem_icms?: string | null
          price_default?: number
          product_group?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          variant_options?: Json | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          account_id?: string
          ai_training?: string | null
          aliq_cofins?: number | null
          aliq_icms?: number | null
          aliq_ipi?: number | null
          aliq_pis?: number | null
          brand?: string | null
          category?: string | null
          cest?: string | null
          cfop_default?: string | null
          cost_default?: number
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          description?: string | null
          description_long?: string | null
          embedding?: string | null
          embedding_text?: string | null
          embedding_updated_at?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          ncm?: string | null
          origem_icms?: string | null
          price_default?: number
          product_group?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          variant_options?: Json | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email_verified: boolean
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_verified?: boolean
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_verified?: boolean
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          notes: string | null
          presentation_id: string | null
          product_id: string
          purchase_order_id: string
          qty_ordered: number
          qty_received: number
          total_line: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          presentation_id?: string | null
          product_id: string
          purchase_order_id: string
          qty_ordered?: number
          qty_received?: number
          total_line?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          presentation_id?: string | null
          product_id?: string
          purchase_order_id?: string
          qty_ordered?: number
          qty_received?: number
          total_line?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "product_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          account_id: string
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          created_by: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_number: number
          ordered_at: string | null
          received_at: string | null
          received_by: string | null
          status: string
          store_id: string | null
          subtotal: number
          supplier_id: string | null
          total: number
          total_discount: number
          total_freight: number
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          ordered_at?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id?: string | null
          total?: number
          total_discount?: number
          total_freight?: number
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          ordered_at?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          store_id?: string | null
          subtotal?: number
          supplier_id?: string | null
          total?: number
          total_discount?: number
          total_freight?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          discount: number
          id: string
          presentation_id: string | null
          product_id: string
          qty: number
          quote_id: string
          total_line: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          discount?: number
          id?: string
          presentation_id?: string | null
          product_id: string
          qty?: number
          quote_id: string
          total_line?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          discount?: number
          id?: string
          presentation_id?: string | null
          product_id?: string
          qty?: number
          quote_id?: string
          total_line?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "product_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          account_id: string
          assembly_fee: number
          converted_at: string | null
          converted_sale_id: string | null
          created_at: string
          customer_id: string | null
          delivery_fee: number
          discount: number
          id: string
          notes: string | null
          quote_number: number
          seller_user_id: string
          status: string
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          account_id: string
          assembly_fee?: number
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          quote_number?: number
          seller_user_id: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          account_id?: string
          assembly_fee?: number
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          quote_number?: number
          seller_user_id?: string
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_campaigns: {
        Row: {
          account_id: string
          active: boolean
          channel: string
          created_at: string
          id: string
          inactive_days: number
          last_run_at: string | null
          message_template: string
          name: string
          store_id: string | null
          target_customer_ids: string[] | null
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          channel?: string
          created_at?: string
          id?: string
          inactive_days?: number
          last_run_at?: string | null
          message_template: string
          name: string
          store_id?: string | null
          target_customer_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          channel?: string
          created_at?: string
          id?: string
          inactive_days?: number
          last_run_at?: string | null
          message_template?: string
          name?: string
          store_id?: string | null
          target_customer_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_log: {
        Row: {
          campaign_id: string
          channel: string
          customer_id: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          channel: string
          customer_id: string
          id?: string
          sent_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          customer_id?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reactivation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_note_items: {
        Row: {
          id: string
          product_id: string
          qty: number
          return_note_id: string
          sale_item_id: string | null
          total_line: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          qty?: number
          return_note_id: string
          sale_item_id?: string | null
          total_line?: number
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string
          qty?: number
          return_note_id?: string
          sale_item_id?: string | null
          total_line?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_note_items_return_note_id_fkey"
            columns: ["return_note_id"]
            isOneToOne: false
            referencedRelation: "return_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_note_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      return_notes: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          id: string
          notes: string | null
          reason: string
          sale_id: string
          status: string
          store_id: string
          total_refund: number
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          reason?: string
          sale_id: string
          status?: string
          store_id: string
          total_refund?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          reason?: string
          sale_id?: string
          status?: string
          store_id?: string
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          base_qty: number | null
          id: string
          presentation_id: string | null
          presentation_name: string | null
          product_id: string
          qty: number
          sale_id: string
          sold_qty: number | null
          total_line: number
          unit_cost: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          base_qty?: number | null
          id?: string
          presentation_id?: string | null
          presentation_name?: string | null
          product_id: string
          qty: number
          sale_id: string
          sold_qty?: number | null
          total_line: number
          unit_cost?: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          base_qty?: number | null
          id?: string
          presentation_id?: string | null
          presentation_name?: string | null
          product_id?: string
          qty?: number
          sale_id?: string
          sold_qty?: number | null
          total_line?: number
          unit_cost?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "product_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          account_id: string
          assembly_fee: number
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          customer_id: string | null
          delivery_fee: number
          discount: number
          down_payment: number
          id: string
          notes: string | null
          order_number: number | null
          payment_on_delivery: boolean
          remaining_balance: number
          seller_user_id: string
          source: string
          status: Database["public"]["Enums"]["sale_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          account_id: string
          assembly_fee?: number
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          down_payment?: number
          id?: string
          notes?: string | null
          order_number?: number | null
          payment_on_delivery?: boolean
          remaining_balance?: number
          seller_user_id: string
          source?: string
          status?: Database["public"]["Enums"]["sale_status"]
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          assembly_fee?: number
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          down_payment?: number
          id?: string
          notes?: string | null
          order_number?: number | null
          payment_on_delivery?: boolean
          remaining_balance?: number
          seller_user_id?: string
          source?: string
          status?: Database["public"]["Enums"]["sale_status"]
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          account_id: string
          active: boolean
          bonus_amount: number
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          scope: string
          seller_user_id: string | null
          store_id: string | null
          target_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          bonus_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          scope?: string
          seller_user_id?: string | null
          store_id?: string | null
          target_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          bonus_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          scope?: string
          seller_user_id?: string | null
          store_id?: string | null
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_commission_rules: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          percent_default: number
          seller_user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          percent_default?: number
          seller_user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          percent_default?: number
          seller_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_commission_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_connections: {
        Row: {
          access_token: string | null
          account_id: string
          connected_at: string | null
          connected_by: string | null
          created_at: string
          id: string
          is_mock: boolean
          last_sync_at: string | null
          refresh_token: string | null
          region: string
          shop_id: string | null
          shop_name: string | null
          status: string
          store_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_mock?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          region?: string
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          store_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_mock?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          region?: string
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_orders: {
        Row: {
          account_id: string
          buyer_name: string | null
          connection_id: string
          created_at: string
          id: string
          payload_json: Json | null
          processed_at: string | null
          sale_id: string | null
          shopee_order_sn: string
          shopee_status: string | null
          store_id: string
          total_amount: number
        }
        Insert: {
          account_id: string
          buyer_name?: string | null
          connection_id: string
          created_at?: string
          id?: string
          payload_json?: Json | null
          processed_at?: string | null
          sale_id?: string | null
          shopee_order_sn: string
          shopee_status?: string | null
          store_id: string
          total_amount?: number
        }
        Update: {
          account_id?: string
          buyer_name?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          payload_json?: Json | null
          processed_at?: string | null
          sale_id?: string | null
          shopee_order_sn?: string
          shopee_status?: string | null
          store_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopee_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shopee_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_product_links: {
        Row: {
          account_id: string
          connection_id: string
          created_at: string
          created_by: string | null
          id: string
          include_variants: boolean
          last_synced_at: string | null
          product_id: string
          shopee_item_id: string | null
          shopee_price: number | null
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          connection_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_variants?: boolean
          last_synced_at?: string | null
          product_id: string
          shopee_item_id?: string | null
          shopee_price?: number | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          connection_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_variants?: boolean
          last_synced_at?: string | null
          product_id?: string
          shopee_item_id?: string | null
          shopee_price?: number | null
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_product_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_product_links_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shopee_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      store_credits: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name_manual: string | null
          id: string
          notes: string | null
          original_amount: number
          reason: string
          remaining_amount: number
          sale_id: string | null
          status: string
          store_id: string
          used_at: string | null
          used_in_sale_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name_manual?: string | null
          id?: string
          notes?: string | null
          original_amount?: number
          reason?: string
          remaining_amount?: number
          sale_id?: string | null
          status?: string
          store_id: string
          used_at?: string | null
          used_in_sale_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name_manual?: string | null
          id?: string
          notes?: string | null
          original_amount?: number
          reason?: string
          remaining_amount?: number
          sale_id?: string | null
          status?: string
          store_id?: string
          used_at?: string | null
          used_in_sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_used_in_sale_id_fkey"
            columns: ["used_in_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ecommerce_settings: {
        Row: {
          about_us: string | null
          account_id: string
          banner_image_url: string | null
          banner_text: string | null
          categories: Json | null
          created_at: string
          delivery_options: Json | null
          description: string | null
          featured_product_ids: string[] | null
          footer_address: string | null
          footer_cnpj: string | null
          footer_email: string | null
          footer_phone: string | null
          header_menu: Json | null
          hero_subtitle: string | null
          id: string
          inline_banners: Json | null
          is_enabled: boolean
          logo_url: string | null
          payment_methods: Json | null
          policy_exchange: string | null
          policy_privacy: string | null
          policy_purchase: string | null
          policy_shipping: string | null
          policy_terms: string | null
          primary_color: string | null
          show_prices: boolean | null
          show_whatsapp_button: boolean | null
          slug: string
          store_id: string
          store_name: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          about_us?: string | null
          account_id: string
          banner_image_url?: string | null
          banner_text?: string | null
          categories?: Json | null
          created_at?: string
          delivery_options?: Json | null
          description?: string | null
          featured_product_ids?: string[] | null
          footer_address?: string | null
          footer_cnpj?: string | null
          footer_email?: string | null
          footer_phone?: string | null
          header_menu?: Json | null
          hero_subtitle?: string | null
          id?: string
          inline_banners?: Json | null
          is_enabled?: boolean
          logo_url?: string | null
          payment_methods?: Json | null
          policy_exchange?: string | null
          policy_privacy?: string | null
          policy_purchase?: string | null
          policy_shipping?: string | null
          policy_terms?: string | null
          primary_color?: string | null
          show_prices?: boolean | null
          show_whatsapp_button?: boolean | null
          slug: string
          store_id: string
          store_name?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          about_us?: string | null
          account_id?: string
          banner_image_url?: string | null
          banner_text?: string | null
          categories?: Json | null
          created_at?: string
          delivery_options?: Json | null
          description?: string | null
          featured_product_ids?: string[] | null
          footer_address?: string | null
          footer_cnpj?: string | null
          footer_email?: string | null
          footer_phone?: string | null
          header_menu?: Json | null
          hero_subtitle?: string | null
          id?: string
          inline_banners?: Json | null
          is_enabled?: boolean
          logo_url?: string | null
          payment_methods?: Json | null
          policy_exchange?: string | null
          policy_privacy?: string | null
          policy_purchase?: string | null
          policy_shipping?: string | null
          policy_terms?: string | null
          primary_color?: string | null
          show_prices?: boolean | null
          show_whatsapp_button?: boolean | null
          slug?: string
          store_id?: string
          store_name?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ecommerce_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_ecommerce_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_memberships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          manager_pin: string | null
          role_in_store: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_pin?: string | null
          role_in_store: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_pin?: string | null
          role_in_store?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transfer_items: {
        Row: {
          id: string
          presentation_id: string | null
          product_id: string
          qty_received: number
          qty_requested: number
          transfer_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          presentation_id?: string | null
          product_id: string
          qty_received?: number
          qty_requested?: number
          transfer_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          presentation_id?: string | null
          product_id?: string
          qty_received?: number
          qty_requested?: number
          transfer_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_transfer_items_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "product_presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "store_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transfers: {
        Row: {
          account_id: string
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          created_by: string
          from_store_id: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          separated_at: string | null
          separated_by: string | null
          shipped_at: string | null
          shipped_by: string | null
          status: string
          to_store_id: string
          transfer_number: number
          updated_at: string
        }
        Insert: {
          account_id: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by: string
          from_store_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          separated_at?: string | null
          separated_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: string
          to_store_id: string
          transfer_number?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string
          from_store_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          separated_at?: string | null
          separated_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: string
          to_store_id?: string
          transfer_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          account_id: string
          address_json: Json | null
          cnpj: string
          created_at: string
          id: string
          ie: string | null
          is_active: boolean
          logo_path: string | null
          logo_updated_at: string | null
          name: string
          pdv_auto_print_fiscal: boolean
          pdv_auto_print_receipt: boolean
          pdv_receipt_format: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
        }
        Insert: {
          account_id: string
          address_json?: Json | null
          cnpj: string
          created_at?: string
          id?: string
          ie?: string | null
          is_active?: boolean
          logo_path?: string | null
          logo_updated_at?: string | null
          name: string
          pdv_auto_print_fiscal?: boolean
          pdv_auto_print_receipt?: boolean
          pdv_receipt_format?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          cnpj?: string
          created_at?: string
          id?: string
          ie?: string | null
          is_active?: boolean
          logo_path?: string | null
          logo_updated_at?: string | null
          name?: string
          pdv_auto_print_fiscal?: boolean
          pdv_auto_print_receipt?: boolean
          pdv_receipt_format?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      supplier_return_items: {
        Row: {
          fiscal_entry_item_id: string | null
          id: string
          product_id: string
          qty: number
          supplier_return_id: string
          total_line: number
          unit_price: number
        }
        Insert: {
          fiscal_entry_item_id?: string | null
          id?: string
          product_id: string
          qty?: number
          supplier_return_id: string
          total_line?: number
          unit_price?: number
        }
        Update: {
          fiscal_entry_item_id?: string | null
          id?: string
          product_id?: string
          qty?: number
          supplier_return_id?: string
          total_line?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_return_items_fiscal_entry_item_id_fkey"
            columns: ["fiscal_entry_item_id"]
            isOneToOne: false
            referencedRelation: "fiscal_entry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_items_supplier_return_id_fkey"
            columns: ["supplier_return_id"]
            isOneToOne: false
            referencedRelation: "supplier_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_returns: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          fiscal_document_id: string | null
          fiscal_entry_id: string
          id: string
          notes: string | null
          status: string
          store_id: string
          supplier_id: string | null
          total_return: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          fiscal_document_id?: string | null
          fiscal_entry_id: string
          id?: string
          notes?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
          total_return?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          fiscal_document_id?: string | null
          fiscal_entry_id?: string
          id?: string
          notes?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          total_return?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_returns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_fiscal_entry_id_fkey"
            columns: ["fiscal_entry_id"]
            isOneToOne: false
            referencedRelation: "fiscal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_id: string
          address_json: Json | null
          cnpj: string
          created_at: string
          delivery_days: number | null
          email: string | null
          id: string
          name: string
          phone: string | null
          trade_name: string | null
        }
        Insert: {
          account_id: string
          address_json?: Json | null
          cnpj: string
          created_at?: string
          delivery_days?: number | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          trade_name?: string | null
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          cnpj?: string
          created_at?: string
          delivery_days?: number | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          trade_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      support_action_alerts: {
        Row: {
          account_id: string
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          matched_keywords: string[]
          reason: string | null
          rule_id: string
          severity: string
          ticket_id: string
        }
        Insert: {
          account_id: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          matched_keywords?: string[]
          reason?: string | null
          rule_id: string
          severity?: string
          ticket_id: string
        }
        Update: {
          account_id?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          matched_keywords?: string[]
          reason?: string | null
          rule_id?: string
          severity?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_action_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "support_action_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_action_alerts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_action_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          keywords: string[]
          match_categories: string[]
          match_priorities: string[]
          match_statuses: string[]
          name: string
          require_unread: boolean
          severity: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_categories?: string[]
          match_priorities?: string[]
          match_statuses?: string[]
          name: string
          require_unread?: boolean
          severity?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_categories?: string[]
          match_priorities?: string[]
          match_statuses?: string[]
          name?: string
          require_unread?: boolean
          severity?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name?: string | null
          sender_type?: string
          ticket_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          account_id: string
          category: string
          client_unread_count: number
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          priority: string
          status: string
          store_id: string | null
          subject: string
          support_unread_count: number
          tags: string[]
          ticket_number: number
          updated_at: string
        }
        Insert: {
          account_id: string
          category?: string
          client_unread_count?: number
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          store_id?: string | null
          subject: string
          support_unread_count?: number
          tags?: string[]
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: string
          client_unread_count?: number
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          store_id?: string | null
          subject?: string
          support_unread_count?: number
          tags?: string[]
          ticket_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_direct_connections: {
        Row: {
          account_id: string
          business_name: string
          cnpj: string
          contact_email: string | null
          contact_phone: string
          created_at: string
          external_store_id: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          max_delivery_radius_km: number | null
          max_weight_kg: number | null
          operating_hours: Json | null
          pickup_address: Json
          store_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          business_name: string
          cnpj: string
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          external_store_id?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          max_delivery_radius_km?: number | null
          max_weight_kg?: number | null
          operating_hours?: Json | null
          pickup_address: Json
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          business_name?: string
          cnpj?: string
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          external_store_id?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          max_delivery_radius_km?: number | null
          max_weight_kg?: number | null
          operating_hours?: Json | null
          pickup_address?: Json
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uber_direct_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uber_direct_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_direct_global_credentials: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          updated_at: string
          webhook_signing_secret: string | null
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
          webhook_signing_secret?: string | null
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
          webhook_signing_secret?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          account_id: string
          attempt: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string | null
          error: string | null
          event: string
          id: string
          next_attempt_at: string
          payload: Json
          response_body: string | null
          status_code: number | null
        }
        Insert: {
          account_id: string
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error?: string | null
          event: string
          id?: string
          next_attempt_at?: string
          payload: Json
          response_body?: string | null
          status_code?: number | null
        }
        Update: {
          account_id?: string
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          error?: string | null
          event?: string
          id?: string
          next_attempt_at?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          description: string | null
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          is_test: boolean
          last_failure_at: string | null
          last_success_at: string | null
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          is_test?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          is_test?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_type: string | null
          id: string
          payload_json: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          event_type?: string | null
          id?: string
          payload_json: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          event_type?: string | null
          id?: string
          payload_json?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      sales_goals_progress: {
        Row: {
          account_id: string | null
          achieved_amount: number | null
          active: boolean | null
          bonus_amount: number | null
          id: string | null
          period_end: string | null
          period_start: string | null
          scope: string | null
          seller_user_id: string | null
          store_id: string | null
          target_amount: number | null
        }
        Insert: {
          account_id?: string | null
          achieved_amount?: never
          active?: boolean | null
          bonus_amount?: number | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
          scope?: string | null
          seller_user_id?: string | null
          store_id?: string | null
          target_amount?: number | null
        }
        Update: {
          account_id?: string | null
          achieved_amount?: never
          active?: boolean | null
          bonus_amount?: number | null
          id?: string | null
          period_end?: string | null
          period_start?: string | null
          scope?: string | null
          seller_user_id?: string | null
          store_id?: string | null
          target_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acknowledge_support_action_alert: {
        Args: { _alert_id: string }
        Returns: undefined
      }
      add_purchased_ai_credits: {
        Args: {
          _account_id: string
          _credits: number
          _notes?: string
          _purchase_id?: string
        }
        Returns: undefined
      }
      admin_adjust_ai_credits: {
        Args: { _account_id: string; _delta: number; _notes: string }
        Returns: Json
      }
      admin_delete_account: {
        Args: { _account_id: string }
        Returns: undefined
      }
      approve_ai_credit_pix: { Args: { _purchase_id: string }; Returns: Json }
      approve_credit_override_with_pin: {
        Args: { _account_id: string; _pin: string; _request_id: string }
        Returns: undefined
      }
      approve_pix_payment: {
        Args: { _months?: number; _request_id: string }
        Returns: Json
      }
      cancel_sale: {
        Args: { _reason?: string; _sale_id: string; _user_id: string }
        Returns: undefined
      }
      consume_ai_credit: {
        Args: { _account_id: string; _reference_id?: string; _user_id: string }
        Returns: Json
      }
      enqueue_webhook_event: {
        Args: { _account_id: string; _event: string; _payload: Json }
        Returns: undefined
      }
      generate_next_sku: { Args: { _account_id: string }; Returns: string }
      generate_unique_birthday_coupon_code: {
        Args: { _prefix: string }
        Returns: string
      }
      get_api_usage_stats: {
        Args: {
          _account_id: string
          _environment?: string
          _from: string
          _to: string
        }
        Returns: Json
      }
      get_customer_used_credit: {
        Args: { _account_id: string; _customer_id: string }
        Returns: number
      }
      get_public_tracking: { Args: { _token: string }; Returns: Json }
      get_user_account_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _account_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["account_role"]
      }
      get_user_store_ids: {
        Args: { _account_id: string; _user_id: string }
        Returns: string[]
      }
      grant_monthly_ai_credits: { Args: { _account_id: string }; Returns: Json }
      has_account_role: {
        Args: {
          _account_id: string
          _roles: Database["public"]["Enums"]["account_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      is_account_member: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      mark_support_ticket_read: {
        Args: { _ticket_id: string }
        Returns: undefined
      }
      match_products: {
        Args: {
          _account_id: string
          _match_count?: number
          _min_similarity?: number
          _query_embedding: string
        }
        Returns: {
          ai_training: string
          brand: string
          category: string
          description: string
          id: string
          image_url: string
          name: string
          price_default: number
          promo_ends_at: string
          promo_price: number
          promo_starts_at: string
          similarity: number
          sku: string
          unit: string
        }[]
      }
      products_indexed_count: { Args: { _account_id: string }; Returns: number }
      products_missing_embedding_count: {
        Args: { _account_id: string }
        Returns: number
      }
      products_total_active_count: {
        Args: { _account_id: string }
        Returns: number
      }
      receive_crediario_installment: {
        Args: {
          _amount: number
          _notes?: string
          _payment_method: string
          _receivable_id: string
          _store_id: string
        }
        Returns: Json
      }
      redeem_birthday_coupon: {
        Args: {
          _account_id: string
          _code: string
          _customer_id: string
          _sale_id: string
        }
        Returns: Json
      }
      refund_ai_credit: {
        Args: { _account_id: string; _reason?: string; _reference_id: string }
        Returns: undefined
      }
      reject_ai_credit_pix: {
        Args: { _purchase_id: string; _reason: string }
        Returns: Json
      }
      reject_pix_payment: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      reset_account_data: { Args: { _account_id: string }; Returns: undefined }
      revoke_api_key: { Args: { _id: string }; Returns: undefined }
      validate_birthday_coupon: {
        Args: {
          _account_id: string
          _code: string
          _customer_id: string
          _subtotal: number
        }
        Returns: Json
      }
      verify_account_pin: {
        Args: { _account_id: string; _pin: string }
        Returns: string
      }
    }
    Enums: {
      account_role: "owner" | "admin" | "manager" | "seller"
      assembly_status:
        | "pending"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "canceled"
      card_type: "debit" | "credit"
      commission_status: "pending" | "paid" | "canceled"
      delivery_status:
        | "pending"
        | "assigned"
        | "out_for_delivery"
        | "delivered"
        | "canceled"
      delivery_type: "pickup" | "delivery"
      fiscal_doc_type: "nfe" | "nfce" | "cupom" | "nfse" | "nfe_complementar"
      import_job_status: "pending" | "processing" | "completed" | "failed"
      nfeio_environment: "prod" | "homolog"
      payment_method:
        | "pix"
        | "cash"
        | "card"
        | "crediario"
        | "financeira"
        | "store_credit"
      sale_status: "draft" | "open" | "paid" | "canceled" | "crediario"
      store_role: "admin" | "manager" | "seller"
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
      account_role: ["owner", "admin", "manager", "seller"],
      assembly_status: [
        "pending",
        "scheduled",
        "in_progress",
        "completed",
        "canceled",
      ],
      card_type: ["debit", "credit"],
      commission_status: ["pending", "paid", "canceled"],
      delivery_status: [
        "pending",
        "assigned",
        "out_for_delivery",
        "delivered",
        "canceled",
      ],
      delivery_type: ["pickup", "delivery"],
      fiscal_doc_type: ["nfe", "nfce", "cupom", "nfse", "nfe_complementar"],
      import_job_status: ["pending", "processing", "completed", "failed"],
      nfeio_environment: ["prod", "homolog"],
      payment_method: [
        "pix",
        "cash",
        "card",
        "crediario",
        "financeira",
        "store_credit",
      ],
      sale_status: ["draft", "open", "paid", "canceled", "crediario"],
      store_role: ["admin", "manager", "seller"],
    },
  },
} as const
