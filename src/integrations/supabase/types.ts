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
      accounts: {
        Row: {
          business_type: Database["public"]["Enums"]["business_type"]
          created_at: string
          id: string
          menu_theme: string | null
          modules: Json | null
          name: string
          owner_pin: string | null
          owner_pin_hash: string | null
          updated_at: string
        }
        Insert: {
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          id: string
          menu_theme?: string | null
          modules?: Json | null
          name: string
          owner_pin?: string | null
          owner_pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          id?: string
          menu_theme?: string | null
          modules?: Json | null
          name?: string
          owner_pin?: string | null
          owner_pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounts_payable: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["payable_status"]
          store_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          store_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          store_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string
          id: string
          installment_no: number | null
          installment_number: number | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          store_id: string | null
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          amount: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          installment_no?: number | null
          installment_number?: number | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          store_id?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          installment_no?: number | null
          installment_number?: number | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          store_id?: string | null
          total_installments?: number | null
          updated_at?: string
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
        ]
      }
      activity_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          account_id?: string
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
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
      assemblers: {
        Row: {
          account_id: string
          created_at: string
          doc: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          doc?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          doc?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assemblers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      assemblies: {
        Row: {
          account_id: string
          assembler_id: string | null
          created_at: string
          customer_id: string | null
          done_at: string | null
          fee: number
          id: string
          notes: string | null
          proof_photo_url: string | null
          sale_id: string | null
          scheduled_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["assembly_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          assembler_id?: string | null
          created_at?: string
          customer_id?: string | null
          done_at?: string | null
          fee?: number
          id?: string
          notes?: string | null
          proof_photo_url?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
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
          customer_id?: string | null
          done_at?: string | null
          fee?: number
          id?: string
          notes?: string | null
          proof_photo_url?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
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
            foreignKeyName: "assemblies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      cash_movements: {
        Row: {
          account_id: string
          amount: number
          cash_register_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          type: string
        }
        Insert: {
          account_id?: string
          amount: number
          cash_register_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          cash_register_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
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
        ]
      }
      cash_registers: {
        Row: {
          account_id: string
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_amount: number
          operator_id: string | null
          status: Database["public"]["Enums"]["cash_register_status"]
          store_id: string
          total_card: number | null
          total_cash: number | null
          total_pix: number | null
          total_sales: number | null
        }
        Insert: {
          account_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          operator_id?: string | null
          status?: Database["public"]["Enums"]["cash_register_status"]
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
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          operator_id?: string | null
          status?: Database["public"]["Enums"]["cash_register_status"]
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
      categories: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_cycles: {
        Row: {
          account_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          seller_id: string | null
          status: string
          total_commission: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          seller_id?: string | null
          status?: string
          total_commission?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          seller_id?: string | null
          status?: string
          total_commission?: number
          total_sales?: number
          updated_at?: string
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
          commission_percent: number | null
          created_at: string
          goal_percent_max: number | null
          goal_percent_min: number | null
          id: string
          is_active: boolean
          max_value: number | null
          min_value: number | null
          percent: number | null
          seller_id: string | null
          tier_type: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          commission_percent?: number | null
          created_at?: string
          goal_percent_max?: number | null
          goal_percent_min?: number | null
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          percent?: number | null
          seller_id?: string | null
          tier_type?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          commission_percent?: number | null
          created_at?: string
          goal_percent_max?: number | null
          goal_percent_min?: number | null
          id?: string
          is_active?: boolean
          max_value?: number | null
          min_value?: number | null
          percent?: number | null
          seller_id?: string | null
          tier_type?: string | null
          updated_at?: string
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
          account_id: string
          amount: number | null
          base_amount: number
          commission_cycle_id: string | null
          created_at: string
          id: string
          paid: boolean
          paid_at: string | null
          percent: number
          sale_id: string
          seller_id: string | null
          status: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          account_id?: string
          amount?: number | null
          base_amount: number
          commission_cycle_id?: string | null
          created_at?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          percent: number
          sale_id: string
          seller_id?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          account_id?: string
          amount?: number | null
          base_amount?: number
          commission_cycle_id?: string | null
          created_at?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          percent?: number
          sale_id?: string
          seller_id?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_commission_cycle_id_fkey"
            columns: ["commission_cycle_id"]
            isOneToOne: false
            referencedRelation: "commission_cycles"
            referencedColumns: ["id"]
          },
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
          amount: number
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_limit: number | null
          customer_id: string
          excess_amount: number | null
          id: string
          reason: string | null
          requested_by: string | null
          sale_amount: number | null
          status: string | null
          used_balance: number | null
        }
        Insert: {
          account_id?: string
          amount: number
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_limit?: number | null
          customer_id: string
          excess_amount?: number | null
          id?: string
          reason?: string | null
          requested_by?: string | null
          sale_amount?: number | null
          status?: string | null
          used_balance?: number | null
        }
        Update: {
          account_id?: string
          amount?: number
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_limit?: number | null
          customer_id?: string
          excess_amount?: number | null
          id?: string
          reason?: string | null
          requested_by?: string | null
          sale_amount?: number | null
          status?: string | null
          used_balance?: number | null
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
        ]
      }
      customer_addresses: {
        Row: {
          account_id: string
          city: string | null
          complement: string | null
          created_at: string
          customer_id: string
          district: string | null
          id: string
          is_default: boolean
          label: string | null
          number: string | null
          state: string | null
          street: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id?: string
          city?: string | null
          complement?: string | null
          created_at?: string
          customer_id: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          number?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          city?: string | null
          complement?: string | null
          created_at?: string
          customer_id?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          number?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_returns: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          fiscal_document_id: string | null
          id: string
          reason: string | null
          requested_at: string | null
          sale_id: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          fiscal_document_id?: string | null
          id?: string
          reason?: string | null
          requested_at?: string | null
          sale_id?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          fiscal_document_id?: string | null
          id?: string
          reason?: string | null
          requested_at?: string | null
          sale_id?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
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
            foreignKeyName: "customer_returns_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
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
          birthday: string | null
          created_at: string
          credit_authorized: boolean
          credit_limit: number
          doc: string | null
          doc_type: string | null
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          address_json?: Json | null
          birth_date?: string | null
          birthday?: string | null
          created_at?: string
          credit_authorized?: boolean
          credit_limit?: number
          doc?: string | null
          doc_type?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          birth_date?: string | null
          birthday?: string | null
          created_at?: string
          credit_authorized?: boolean
          credit_limit?: number
          doc?: string | null
          doc_type?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
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
          city: string | null
          complement: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_type: string
          district: string | null
          driver_id: string | null
          eta_at: string | null
          freight: number
          id: string
          notes: string | null
          number: string | null
          proof_photo_url: string | null
          sale_id: string | null
          scheduled_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          state: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          street: string | null
          tracking_token: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_type?: string
          district?: string | null
          driver_id?: string | null
          eta_at?: string | null
          freight?: number
          id?: string
          notes?: string | null
          number?: string | null
          proof_photo_url?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          street?: string | null
          tracking_token?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          complement?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_type?: string
          district?: string | null
          driver_id?: string | null
          eta_at?: string | null
          freight?: number
          id?: string
          notes?: string | null
          number?: string | null
          proof_photo_url?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          street?: string | null
          tracking_token?: string | null
          updated_at?: string
          zip?: string | null
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
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          doc: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          store_id: string | null
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          doc?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          doc?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_logs: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          id: string
          provider_id: string | null
          status: string
          subject: string | null
          template: string | null
          to_email: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
        }
        Relationships: []
      }
      fiscal_corrections: {
        Row: {
          account_id: string
          correction_text: string
          created_at: string
          created_by: string | null
          fiscal_document_id: string
          id: string
          protocol: string | null
          raw_response: Json | null
          sequence_no: number
          status: string
        }
        Insert: {
          account_id?: string
          correction_text: string
          created_at?: string
          created_by?: string | null
          fiscal_document_id: string
          id?: string
          protocol?: string | null
          raw_response?: Json | null
          sequence_no?: number
          status?: string
        }
        Update: {
          account_id?: string
          correction_text?: string
          created_at?: string
          created_by?: string | null
          fiscal_document_id?: string
          id?: string
          protocol?: string | null
          raw_response?: Json | null
          sequence_no?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_corrections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string
          authorized_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contingency_mode: boolean
          created_at: string
          created_by: string | null
          customer_id: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          external_id: string | null
          id: string
          number: number | null
          pdf_url: string | null
          protocol: string | null
          purpose: string
          raw_payload: Json | null
          raw_response: Json | null
          rejection_reason: string | null
          sale_id: string | null
          series: number | null
          status: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id: string
          total_amount: number | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          account_id?: string
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contingency_mode?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          external_id?: string | null
          id?: string
          number?: number | null
          pdf_url?: string | null
          protocol?: string | null
          purpose?: string
          raw_payload?: Json | null
          raw_response?: Json | null
          rejection_reason?: string | null
          sale_id?: string | null
          series?: number | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id: string
          total_amount?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          account_id?: string
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contingency_mode?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          doc_type?: Database["public"]["Enums"]["fiscal_doc_type"]
          external_id?: string | null
          id?: string
          number?: number | null
          pdf_url?: string | null
          protocol?: string | null
          purpose?: string
          raw_payload?: Json | null
          raw_response?: Json | null
          rejection_reason?: string | null
          sale_id?: string | null
          series?: number | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id?: string
          total_amount?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          issue_date: string | null
          issued_at: string | null
          nfe_number: string | null
          nfe_series: string | null
          notes: string | null
          number: number | null
          pdf_path: string | null
          raw_payload: Json | null
          series: number | null
          status: string
          store_id: string
          supplier_id: string | null
          total_amount: number | null
          total_discount: number | null
          total_freight: number | null
          total_nfe: number | null
          total_products: number | null
          updated_at: string
          xml_path: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          issued_at?: string | null
          nfe_number?: string | null
          nfe_series?: string | null
          notes?: string | null
          number?: number | null
          pdf_path?: string | null
          raw_payload?: Json | null
          series?: number | null
          status?: string
          store_id: string
          supplier_id?: string | null
          total_amount?: number | null
          total_discount?: number | null
          total_freight?: number | null
          total_nfe?: number | null
          total_products?: number | null
          updated_at?: string
          xml_path?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          issued_at?: string | null
          nfe_number?: string | null
          nfe_series?: string | null
          notes?: string | null
          number?: number | null
          pdf_path?: string | null
          raw_payload?: Json | null
          series?: number | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          total_amount?: number | null
          total_discount?: number | null
          total_freight?: number | null
          total_nfe?: number | null
          total_products?: number | null
          updated_at?: string
          xml_path?: string | null
          xml_url?: string | null
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
          account_id: string
          cfop: string | null
          created_at: string
          created_product: boolean | null
          description: string | null
          fiscal_entry_id: string
          id: string
          matched: boolean | null
          ncm: string | null
          product_id: string | null
          qty: number | null
          quantity: number | null
          total: number | null
          total_line: number | null
          unit: string | null
          unit_cost: number | null
          unit_price: number | null
          xml_code: string | null
        }
        Insert: {
          account_id?: string
          cfop?: string | null
          created_at?: string
          created_product?: boolean | null
          description?: string | null
          fiscal_entry_id: string
          id?: string
          matched?: boolean | null
          ncm?: string | null
          product_id?: string | null
          qty?: number | null
          quantity?: number | null
          total?: number | null
          total_line?: number | null
          unit?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          xml_code?: string | null
        }
        Update: {
          account_id?: string
          cfop?: string | null
          created_at?: string
          created_product?: boolean | null
          description?: string | null
          fiscal_entry_id?: string
          id?: string
          matched?: boolean | null
          ncm?: string | null
          product_id?: string | null
          qty?: number | null
          quantity?: number | null
          total?: number | null
          total_line?: number | null
          unit?: string | null
          unit_cost?: number | null
          unit_price?: number | null
          xml_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_entry_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          created_by: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          id: string
          number_from: number
          number_to: number
          protocol: string | null
          raw_response: Json | null
          reason: string
          series: number
          status: string
          store_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          id?: string
          number_from: number
          number_to: number
          protocol?: string | null
          raw_response?: Json | null
          reason: string
          series: number
          status?: string
          store_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["fiscal_doc_type"]
          id?: string
          number_from?: number
          number_to?: number
          protocol?: string | null
          raw_response?: Json | null
          reason?: string
          series?: number
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invalidations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invalidations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_xml_backups: {
        Row: {
          account_id: string
          backed_up_at: string | null
          created_at: string
          fiscal_document_id: string | null
          id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          account_id?: string
          backed_up_at?: string | null
          created_at?: string
          fiscal_document_id?: string | null
          id?: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          account_id?: string
          backed_up_at?: string | null
          created_at?: string
          fiscal_document_id?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_xml_backups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_xml_backups_fiscal_document_id_fkey"
            columns: ["fiscal_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_nfe_settings: {
        Row: {
          account_id: string
          api_key: string | null
          api_key_secret_id: string | null
          block_sale_without_fiscal_data: boolean
          certificate_expires_at: string | null
          certificate_uploaded: boolean
          company_id: string | null
          created_at: string
          csc_id: string | null
          csc_token: string | null
          email_default: string | null
          environment: string
          id: string
          is_active: boolean
          is_enabled: boolean
          nfce_next_number: number | null
          nfce_series: number | null
          nfe_next_number: number | null
          nfe_series: number | null
          nfse_aliquota: number
          nfse_cnae: string | null
          nfse_enabled: boolean
          nfse_iss_retido: boolean
          nfse_item_description: string | null
          nfse_next_number: number | null
          nfse_series: number | null
          nfse_service_code: string | null
          store_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          account_id?: string
          api_key?: string | null
          api_key_secret_id?: string | null
          block_sale_without_fiscal_data?: boolean
          certificate_expires_at?: string | null
          certificate_uploaded?: boolean
          company_id?: string | null
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          email_default?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          nfce_next_number?: number | null
          nfce_series?: number | null
          nfe_next_number?: number | null
          nfe_series?: number | null
          nfse_aliquota?: number
          nfse_cnae?: string | null
          nfse_enabled?: boolean
          nfse_iss_retido?: boolean
          nfse_item_description?: string | null
          nfse_next_number?: number | null
          nfse_series?: number | null
          nfse_service_code?: string | null
          store_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          account_id?: string
          api_key?: string | null
          api_key_secret_id?: string | null
          block_sale_without_fiscal_data?: boolean
          certificate_expires_at?: string | null
          certificate_uploaded?: boolean
          company_id?: string | null
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          email_default?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          nfce_next_number?: number | null
          nfce_series?: number | null
          nfe_next_number?: number | null
          nfe_series?: number | null
          nfse_aliquota?: number
          nfse_cnae?: string | null
          nfse_enabled?: boolean
          nfse_iss_retido?: boolean
          nfse_item_description?: string | null
          nfse_next_number?: number | null
          nfse_series?: number | null
          nfse_service_code?: string | null
          store_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_nfe_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_nfe_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sales: {
        Row: {
          account_id: string
          cart_json: Json | null
          cart_snapshot: Json
          created_at: string
          customer_id: string | null
          id: string
          label: string | null
          seller_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          cart_json?: Json | null
          cart_snapshot: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          seller_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          cart_json?: Json | null
          cart_snapshot?: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          seller_id?: string | null
          store_id?: string
          updated_at?: string
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
      inventory: {
        Row: {
          account_id: string
          expiration_date: string | null
          id: string
          min_qty: number | null
          product_id: string
          qty: number
          qty_on_hand: number | null
          reorder_point: number | null
          reserved_qty: number
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          expiration_date?: string | null
          id?: string
          min_qty?: number | null
          product_id: string
          qty?: number
          qty_on_hand?: number | null
          reorder_point?: number | null
          reserved_qty?: number
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          expiration_date?: string | null
          id?: string
          min_qty?: number | null
          product_id?: string
          qty?: number
          qty_on_hand?: number | null
          reorder_point?: number | null
          reserved_qty?: number
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
      inventory_movements: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          qty: number
          ref_id: string | null
          ref_table: string | null
          store_id: string
          type: Database["public"]["Enums"]["inventory_movement_type"]
          unit_cost: number | null
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          qty: number
          ref_id?: string | null
          ref_table?: string | null
          store_id: string
          type: Database["public"]["Enums"]["inventory_movement_type"]
          unit_cost?: number | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          qty?: number
          ref_id?: string | null
          ref_table?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["inventory_movement_type"]
          unit_cost?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_documents: {
        Row: {
          access_key: string | null
          account_id: string
          authorized_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          dest_state: string | null
          driver_doc: string | null
          driver_name: string | null
          id: string
          linked_nfes: Json | null
          number: number | null
          origin_state: string | null
          pdf_url: string | null
          protocol: string | null
          raw_payload: Json | null
          raw_response: Json | null
          route: Json | null
          series: number | null
          status: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id: string
          updated_at: string
          vehicle_plate: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          account_id?: string
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          dest_state?: string | null
          driver_doc?: string | null
          driver_name?: string | null
          id?: string
          linked_nfes?: Json | null
          number?: number | null
          origin_state?: string | null
          pdf_url?: string | null
          protocol?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          route?: Json | null
          series?: number | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id: string
          updated_at?: string
          vehicle_plate?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          account_id?: string
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          dest_state?: string | null
          driver_doc?: string | null
          driver_name?: string | null
          id?: string
          linked_nfes?: Json | null
          number?: number | null
          origin_state?: string | null
          pdf_url?: string | null
          protocol?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          route?: Json | null
          series?: number | null
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          store_id?: string
          updated_at?: string
          vehicle_plate?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
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
          access_token: string
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          public_key: string | null
          store_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token: string
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          public_key?: string | null
          store_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          public_key?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mp_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mp_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_payments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          external_reference: string | null
          id: string
          mp_payment_id: string | null
          provider: string | null
          qr_code: string | null
          qr_code_base64: string | null
          raw_payload: Json | null
          sale_id: string | null
          status: string
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          amount: number
          created_at?: string
          external_reference?: string | null
          id?: string
          mp_payment_id?: string | null
          provider?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          status: string
          store_id: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          external_reference?: string | null
          id?: string
          mp_payment_id?: string | null
          provider?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          status?: string
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mp_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mp_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_destination_manifest: {
        Row: {
          access_key: string
          account_id: string
          created_at: string
          emitter_cnpj: string | null
          emitter_name: string | null
          id: string
          issued_at: string | null
          manifest_event: string | null
          manifest_protocol: string | null
          manifested_at: string | null
          raw_payload: Json | null
          status: string
          store_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          access_key: string
          account_id?: string
          created_at?: string
          emitter_cnpj?: string | null
          emitter_name?: string | null
          id?: string
          issued_at?: string | null
          manifest_event?: string | null
          manifest_protocol?: string | null
          manifested_at?: string | null
          raw_payload?: Json | null
          status?: string
          store_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          access_key?: string
          account_id?: string
          created_at?: string
          emitter_cnpj?: string | null
          emitter_name?: string | null
          id?: string
          issued_at?: string | null
          manifest_event?: string | null
          manifest_protocol?: string | null
          manifested_at?: string | null
          raw_payload?: Json | null
          status?: string
          store_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfe_destination_manifest_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_destination_manifest_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string
          amount: number | null
          authorization_code: string | null
          brand: string | null
          card_fee_percent: number
          card_fee_value: number
          card_type: string | null
          created_at: string
          id: string
          installments: number | null
          metadata: Json | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          paid_value: number | null
          receivable_id: string | null
          sale_id: string | null
        }
        Insert: {
          account_id?: string
          amount?: number | null
          authorization_code?: string | null
          brand?: string | null
          card_fee_percent?: number
          card_fee_value?: number
          card_type?: string | null
          created_at?: string
          id?: string
          installments?: number | null
          metadata?: Json | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          paid_value?: number | null
          receivable_id?: string | null
          sale_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number | null
          authorization_code?: string | null
          brand?: string | null
          card_fee_percent?: number
          card_fee_value?: number
          card_type?: string | null
          created_at?: string
          id?: string
          installments?: number | null
          metadata?: Json | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          paid_value?: number | null
          receivable_id?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string
          barcode: string | null
          created_at: string
          id: string
          picking_order_id: string
          product_id: string
          qty_picked: number
          qty_required: number
          sku: string | null
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          barcode?: string | null
          created_at?: string
          id?: string
          picking_order_id: string
          product_id: string
          qty_picked?: number
          qty_required: number
          sku?: string | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          barcode?: string | null
          created_at?: string
          id?: string
          picking_order_id?: string
          product_id?: string
          qty_picked?: number
          qty_required?: number
          sku?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picking_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "picking_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
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
          picker_id: string | null
          sale_id: string | null
          started_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          picker_id?: string | null
          sale_id?: string | null
          started_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          picker_id?: string | null
          sale_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
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
      product_expiration_dates: {
        Row: {
          account_id: string | null
          batch_label: string | null
          created_at: string
          expiration_date: string | null
          expires_at: string | null
          fiscal_entry_id: string | null
          id: string
          lot: string | null
          product_id: string
          qty: number | null
          qty_on_hand: number | null
          quantity: number | null
          store_id: string | null
          variant_id: string | null
        }
        Insert: {
          account_id?: string | null
          batch_label?: string | null
          created_at?: string
          expiration_date?: string | null
          expires_at?: string | null
          fiscal_entry_id?: string | null
          id?: string
          lot?: string | null
          product_id: string
          qty?: number | null
          qty_on_hand?: number | null
          quantity?: number | null
          store_id?: string | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string | null
          batch_label?: string | null
          created_at?: string
          expiration_date?: string | null
          expires_at?: string | null
          fiscal_entry_id?: string | null
          id?: string
          lot?: string | null
          product_id?: string
          qty?: number | null
          qty_on_hand?: number | null
          quantity?: number | null
          store_id?: string | null
          variant_id?: string | null
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
          {
            foreignKeyName: "product_expiration_dates_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          product_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
          conversion_factor: number | null
          created_at: string
          factor: number | null
          gtin: string | null
          id: string
          is_active: boolean
          is_purchase: boolean
          is_sale: boolean
          name: string
          price: number | null
          product_id: string
          purchase_unit_code: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          factor?: number | null
          gtin?: string | null
          id?: string
          is_active?: boolean
          is_purchase?: boolean
          is_sale?: boolean
          name: string
          price?: number | null
          product_id: string
          purchase_unit_code?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          factor?: number | null
          gtin?: string | null
          id?: string
          is_active?: boolean
          is_purchase?: boolean
          is_sale?: boolean
          name?: string
          price?: number | null
          product_id?: string
          purchase_unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_presentations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          min_qty: number
          price: number | null
          product_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          min_qty: number
          price?: number | null
          product_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          min_qty?: number
          price?: number | null
          product_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
          created_at: string
          id: string
          image_url: string | null
          sort_order: number | null
          url: string | null
          variant_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number | null
          url?: string | null
          variant_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number | null
          url?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_images_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
          attributes: Json
          cost: number | null
          created_at: string
          gtin: string | null
          id: string
          is_active: boolean
          price: number | null
          product_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          attributes?: Json
          cost?: number | null
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          price?: number | null
          product_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          attributes?: Json
          cost?: number | null
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          price?: number | null
          product_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          barcode: string | null
          brand: string | null
          category: string | null
          cest: string | null
          cfop: string | null
          cfop_default: string | null
          cofins_cst: string | null
          cost: number | null
          cost_default: number
          cover_image_url: string | null
          created_at: string
          depth_cm: number | null
          description: string | null
          fiscal_unit: string | null
          gtin: string | null
          height_cm: number | null
          icms_aliquota: number | null
          icms_cst: string | null
          id: string
          image_url: string | null
          ipi_cst: string | null
          is_active: boolean
          name: string
          ncm: string | null
          origin: string | null
          pis_cst: string | null
          price_default: number
          promo_ends_at: string | null
          promo_price: number | null
          promo_starts_at: string | null
          sku: string | null
          subcategory: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          account_id?: string
          ai_training?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cfop_default?: string | null
          cofins_cst?: string | null
          cost?: number | null
          cost_default?: number
          cover_image_url?: string | null
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          fiscal_unit?: string | null
          gtin?: string | null
          height_cm?: number | null
          icms_aliquota?: number | null
          icms_cst?: string | null
          id?: string
          image_url?: string | null
          ipi_cst?: string | null
          is_active?: boolean
          name: string
          ncm?: string | null
          origin?: string | null
          pis_cst?: string | null
          price_default?: number
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          account_id?: string
          ai_training?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cest?: string | null
          cfop?: string | null
          cfop_default?: string | null
          cofins_cst?: string | null
          cost?: number | null
          cost_default?: number
          cover_image_url?: string | null
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          fiscal_unit?: string | null
          gtin?: string | null
          height_cm?: number | null
          icms_aliquota?: number | null
          icms_cst?: string | null
          id?: string
          image_url?: string | null
          ipi_cst?: string | null
          is_active?: boolean
          name?: string
          ncm?: string | null
          origin?: string | null
          pis_cst?: string | null
          price_default?: number
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
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
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          account_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          purchase_order_id: string
          qty: number | null
          qty_ordered: number | null
          qty_received: number
          total: number | null
          total_line: number | null
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          purchase_order_id: string
          qty?: number | null
          qty_ordered?: number | null
          qty_received?: number
          total?: number | null
          total_line?: number | null
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          purchase_order_id?: string
          qty?: number | null
          qty_ordered?: number | null
          qty_received?: number
          total?: number | null
          total_line?: number | null
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_number: number | null
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          store_id: string
          subtotal: number | null
          supplier_id: string
          total: number
          type: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          store_id: string
          subtotal?: number | null
          supplier_id: string
          total?: number
          type?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          store_id?: string
          subtotal?: number | null
          supplier_id?: string
          total?: number
          type?: string | null
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
          account_id: string
          created_at: string
          discount: number
          id: string
          product_id: string
          qty: number
          quote_id: string
          total: number | null
          total_line: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          discount?: number
          id?: string
          product_id: string
          qty: number
          quote_id: string
          total?: number | null
          total_line?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          discount?: number
          id?: string
          product_id?: string
          qty?: number
          quote_id?: string
          total?: number | null
          total_line?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          converted_sale_id: string | null
          created_at: string
          customer_id: string | null
          delivery_fee: number
          discount: number
          id: string
          notes: string | null
          quote_number: number | null
          seller_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          account_id?: string
          assembly_fee?: number
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          quote_number?: number | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          account_id?: string
          assembly_fee?: number
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          id?: string
          notes?: string | null
          quote_number?: number | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
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
      return_notes: {
        Row: {
          account_id: string
          created_at: string
          customer_return_id: string
          id: string
          product_id: string
          qty: number
          sale_item_id: string | null
          total: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          customer_return_id: string
          id?: string
          product_id: string
          qty: number
          sale_item_id?: string | null
          total: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_return_id?: string
          id?: string
          product_id?: string
          qty?: number
          sale_item_id?: string | null
          total?: number
          unit_price?: number
          variant_id?: string | null
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
            foreignKeyName: "return_notes_customer_return_id_fkey"
            columns: ["customer_return_id"]
            isOneToOne: false
            referencedRelation: "customer_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_notes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          account_id: string
          base_qty: number | null
          cost_at_sale: number | null
          created_at: string
          discount: number
          id: string
          presentation_id: string | null
          presentation_name: string | null
          product_id: string
          qty: number
          sale_id: string
          sold_qty: number | null
          total: number | null
          total_line: number | null
          unit_cost: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          base_qty?: number | null
          cost_at_sale?: number | null
          created_at?: string
          discount?: number
          id?: string
          presentation_id?: string | null
          presentation_name?: string | null
          product_id: string
          qty: number
          sale_id: string
          sold_qty?: number | null
          total?: number | null
          total_line?: number | null
          unit_cost?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          base_qty?: number | null
          cost_at_sale?: number | null
          created_at?: string
          discount?: number
          id?: string
          presentation_id?: string | null
          presentation_name?: string | null
          product_id?: string
          qty?: number
          sale_id?: string
          sold_qty?: number | null
          total?: number | null
          total_line?: number | null
          unit_cost?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          customer_id: string | null
          delivery_fee: number
          discount: number
          down_payment: number
          freight: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_on_delivery: boolean
          remaining_balance: number
          sale_number: number | null
          seller_id: string | null
          source: string
          status: Database["public"]["Enums"]["sale_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          account_id?: string
          assembly_fee?: number
          cancel_reason?: string | null
          canceled_at?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          down_payment?: number
          freight?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_on_delivery?: boolean
          remaining_balance?: number
          sale_number?: number | null
          seller_id?: string | null
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
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number
          discount?: number
          down_payment?: number
          freight?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_on_delivery?: boolean
          remaining_balance?: number
          sale_number?: number | null
          seller_id?: string | null
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
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          scope: string
          seller_id: string | null
          store_id: string | null
          target_amount: number
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          scope?: string
          seller_id?: string | null
          store_id?: string | null
          target_amount: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          scope?: string
          seller_id?: string | null
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
      sales_goals_progress: {
        Row: {
          account_id: string
          current_amount: number
          id: string
          percent: number
          sales_goal_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string
          current_amount?: number
          id?: string
          percent?: number
          sales_goal_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          current_amount?: number
          id?: string
          percent?: number
          sales_goal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_progress_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_progress_sales_goal_id_fkey"
            columns: ["sales_goal_id"]
            isOneToOne: false
            referencedRelation: "sales_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_commission_rules: {
        Row: {
          account_id: string
          base_percent: number | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          percent_default: number | null
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          base_percent?: number | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          percent_default?: number | null
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          base_percent?: number | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          percent_default?: number | null
          seller_id?: string | null
          updated_at?: string
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
      site_categories: {
        Row: {
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_photos: {
        Row: {
          caption: string | null
          category_id: string | null
          created_at: string
          id: string
          image_path: string
          is_active: boolean
          sort_order: number
          title: string | null
        }
        Insert: {
          caption?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_path: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
        }
        Update: {
          caption?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_photos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "site_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          about_text: string | null
          about_title: string | null
          address: string | null
          brand_name: string
          created_at: string
          email: string | null
          facebook_url: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          hours_saturday: string | null
          hours_sunday: string | null
          hours_weekdays: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          show_facebook: boolean
          show_instagram: boolean
          tagline: string | null
          updated_at: string
          whatsapp_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          about_text?: string | null
          about_title?: string | null
          address?: string | null
          brand_name?: string
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hours_saturday?: string | null
          hours_sunday?: string | null
          hours_weekdays?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          show_facebook?: boolean
          show_instagram?: boolean
          tagline?: string | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          about_text?: string | null
          about_title?: string | null
          address?: string | null
          brand_name?: string
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hours_saturday?: string | null
          hours_sunday?: string | null
          hours_weekdays?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          show_facebook?: boolean
          show_instagram?: boolean
          tagline?: string | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      store_credits: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          customer_id: string
          customer_name_manual: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          origin_sale_id: string | null
          original_amount: number | null
          reason: string | null
          remaining_amount: number | null
          sale_id: string | null
          status: string | null
          store_id: string | null
          updated_at: string
          used_amount: number
          used_at: string | null
          used_in_sale_id: string | null
        }
        Insert: {
          account_id?: string
          amount: number
          created_at?: string
          customer_id: string
          customer_name_manual?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          origin_sale_id?: string | null
          original_amount?: number | null
          reason?: string | null
          remaining_amount?: number | null
          sale_id?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
          used_amount?: number
          used_at?: string | null
          used_in_sale_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          customer_id?: string
          customer_name_manual?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          origin_sale_id?: string | null
          original_amount?: number | null
          reason?: string | null
          remaining_amount?: number | null
          sale_id?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
          used_amount?: number
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
            foreignKeyName: "store_credits_origin_sale_id_fkey"
            columns: ["origin_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
        ]
      }
      store_memberships: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          manager_pin: string | null
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_pin?: string | null
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_pin?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string
          created_at: string
          id: string
          product_id: string
          qty: number | null
          qty_received: number
          qty_requested: number | null
          store_transfer_id: string | null
          transfer_id: string | null
          unit_cost: number | null
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          product_id: string
          qty?: number | null
          qty_received?: number
          qty_requested?: number | null
          store_transfer_id?: string | null
          transfer_id?: string | null
          unit_cost?: number | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          product_id?: string
          qty?: number | null
          qty_received?: number
          qty_requested?: number | null
          store_transfer_id?: string | null
          transfer_id?: string | null
          unit_cost?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_transfer_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
            foreignKeyName: "store_transfer_items_store_transfer_id_fkey"
            columns: ["store_transfer_id"]
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
          created_by: string | null
          dest_store_id: string
          from_store_id: string | null
          id: string
          notes: string | null
          origin_store_id: string
          received_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_store_id: string | null
          transfer_number: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          dest_store_id: string
          from_store_id?: string | null
          id?: string
          notes?: string | null
          origin_store_id: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_store_id?: string | null
          transfer_number?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          dest_store_id?: string
          from_store_id?: string | null
          id?: string
          notes?: string | null
          origin_store_id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_store_id?: string | null
          transfer_number?: number | null
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
            foreignKeyName: "store_transfers_dest_store_id_fkey"
            columns: ["dest_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            foreignKeyName: "store_transfers_origin_store_id_fkey"
            columns: ["origin_store_id"]
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
          city: string | null
          cnae: string | null
          cnpj: string | null
          complement: string | null
          country: string | null
          created_at: string
          district: string | null
          email: string | null
          id: string
          ie: string | null
          im: string | null
          is_active: boolean
          legal_name: string | null
          logo_path: string | null
          logo_updated_at: string | null
          logo_url: string | null
          name: string
          number: string | null
          pdv_auto_print_fiscal: boolean
          pdv_auto_print_receipt: boolean
          pdv_receipt_format: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          state: string | null
          street: string | null
          tax_regime: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          cnae?: string | null
          cnpj?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          id: string
          ie?: string | null
          im?: string | null
          is_active?: boolean
          legal_name?: string | null
          logo_path?: string | null
          logo_updated_at?: string | null
          logo_url?: string | null
          name: string
          number?: string | null
          pdv_auto_print_fiscal?: boolean
          pdv_auto_print_receipt?: boolean
          pdv_receipt_format?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          street?: string | null
          tax_regime?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          cnae?: string | null
          cnpj?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          is_active?: boolean
          legal_name?: string | null
          logo_path?: string | null
          logo_updated_at?: string | null
          logo_url?: string | null
          name?: string
          number?: string | null
          pdv_auto_print_fiscal?: boolean
          pdv_auto_print_receipt?: boolean
          pdv_receipt_format?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          street?: string | null
          tax_regime?: string | null
          updated_at?: string
          zip?: string | null
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
      supplier_return_items: {
        Row: {
          account_id: string
          created_at: string
          id: string
          product_id: string
          qty: number
          supplier_return_id: string
          total: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          account_id?: string
          created_at?: string
          id?: string
          product_id: string
          qty: number
          supplier_return_id: string
          total: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          supplier_return_id?: string
          total?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_return_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          {
            foreignKeyName: "supplier_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_returns: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          fiscal_document_id: string | null
          id: string
          reason: string | null
          status: string
          store_id: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          fiscal_document_id?: string | null
          id?: string
          reason?: string | null
          status?: string
          store_id: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          fiscal_document_id?: string | null
          id?: string
          reason?: string | null
          status?: string
          store_id?: string
          supplier_id?: string
          total_amount?: number
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
          city: string | null
          cnpj: string | null
          complement: string | null
          created_at: string
          district: string | null
          doc: string | null
          email: string | null
          id: string
          ie: string | null
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          number: string | null
          phone: string | null
          state: string | null
          street: string | null
          trade_name: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          address_json?: Json | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          zip?: string | null
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
    }
    Views: {
      nfeio_settings: {
        Row: {
          account_id: string | null
          api_key: string | null
          api_key_secret_id: string | null
          block_sale_without_fiscal_data: boolean | null
          certificate_expires_at: string | null
          certificate_uploaded: boolean | null
          company_id: string | null
          created_at: string | null
          csc_id: string | null
          csc_token: string | null
          email_default: string | null
          environment: string | null
          id: string | null
          is_active: boolean | null
          is_enabled: boolean | null
          nfce_next_number: number | null
          nfce_series: number | null
          nfe_next_number: number | null
          nfe_series: number | null
          nfse_aliquota: number | null
          nfse_cnae: string | null
          nfse_enabled: boolean | null
          nfse_iss_retido: boolean | null
          nfse_item_description: string | null
          nfse_next_number: number | null
          nfse_series: number | null
          nfse_service_code: string | null
          store_id: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          account_id?: string | null
          api_key?: string | null
          api_key_secret_id?: string | null
          block_sale_without_fiscal_data?: boolean | null
          certificate_expires_at?: string | null
          certificate_uploaded?: boolean | null
          company_id?: string | null
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          email_default?: string | null
          environment?: string | null
          id?: string | null
          is_active?: boolean | null
          is_enabled?: boolean | null
          nfce_next_number?: number | null
          nfce_series?: number | null
          nfe_next_number?: number | null
          nfe_series?: number | null
          nfse_aliquota?: number | null
          nfse_cnae?: string | null
          nfse_enabled?: boolean | null
          nfse_iss_retido?: boolean | null
          nfse_item_description?: string | null
          nfse_next_number?: number | null
          nfse_series?: number | null
          nfse_service_code?: string | null
          store_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          account_id?: string | null
          api_key?: string | null
          api_key_secret_id?: string | null
          block_sale_without_fiscal_data?: boolean | null
          certificate_expires_at?: string | null
          certificate_uploaded?: boolean | null
          company_id?: string | null
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          email_default?: string | null
          environment?: string | null
          id?: string | null
          is_active?: boolean | null
          is_enabled?: boolean | null
          nfce_next_number?: number | null
          nfce_series?: number | null
          nfe_next_number?: number | null
          nfe_series?: number | null
          nfse_aliquota?: number | null
          nfse_cnae?: string | null
          nfse_enabled?: boolean | null
          nfse_iss_retido?: boolean | null
          nfse_item_description?: string | null
          nfse_next_number?: number | null
          nfse_series?: number | null
          nfse_service_code?: string | null
          store_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_nfe_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_nfe_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_credit_override_with_pin: {
        Args: { pin: string; request_id: string }
        Returns: boolean
      }
      cancel_sale: {
        Args: { reason?: string; sale_id: string }
        Returns: undefined
      }
      current_account_id: { Args: never; Returns: string }
      current_store_id: { Args: never; Returns: string }
      generate_next_sku:
        | { Args: { _account_id?: string; prefix?: string }; Returns: string }
        | { Args: { prefix?: string }; Returns: string }
      get_customer_used_credit: {
        Args: { customer_id: string }
        Returns: number
      }
      get_focus_nfe_api_key: { Args: { p_store_id: string }; Returns: string }
      get_public_tracking: { Args: { _token: string }; Returns: Json }
      has_account_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_member: { Args: { _user_id: string }; Returns: boolean }
      receive_crediario_installment: {
        Args: {
          _amount?: number
          _notes?: string
          _payment_method?: Database["public"]["Enums"]["payment_method"]
          _receivable_id: string
          _store_id?: string
        }
        Returns: Json
      }
      reset_account_data: { Args: { pin: string }; Returns: undefined }
      restore_inventory_for_item: {
        Args: { item_id: string }
        Returns: undefined
      }
      set_focus_nfe_api_key: {
        Args: { p_api_key: string; p_pin: string; p_store_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      verify_account_pin: { Args: { pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "seller"
      assembly_status:
        | "pending"
        | "scheduled"
        | "in_progress"
        | "done"
        | "cancelled"
        | "completed"
      business_type: "interiores" | "generico"
      cash_register_status: "open" | "closed"
      delivery_status:
        | "pending"
        | "scheduled"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "cancelled"
        | "assigned"
      fiscal_doc_status:
        | "pending"
        | "authorized"
        | "rejected"
        | "cancelled"
        | "denied"
        | "contingency"
        | "issued"
        | "processing"
        | "completed"
      fiscal_doc_type: "nfe" | "nfce" | "nfse" | "mdfe"
      inventory_movement_type:
        | "purchase"
        | "sale"
        | "return_in"
        | "return_out"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "loss"
      payable_status: "open" | "partial" | "paid" | "overdue" | "cancelled"
      payment_method:
        | "cash"
        | "pix"
        | "debit"
        | "credit"
        | "crediario"
        | "store_credit"
        | "transfer"
        | "mp_pix"
        | "mp_point"
        | "card"
        | "financeira"
      purchase_order_status:
        | "draft"
        | "sent"
        | "partial"
        | "received"
        | "cancelled"
        | "requested"
      quote_status:
        | "open"
        | "accepted"
        | "converted"
        | "expired"
        | "cancelled"
        | "draft"
        | "sent"
      receivable_status: "open" | "partial" | "paid" | "overdue" | "cancelled"
      sale_status:
        | "draft"
        | "held"
        | "paid"
        | "cancelled"
        | "returned"
        | "crediario"
        | "open"
      transfer_status: "draft" | "sent" | "received" | "cancelled"
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
      app_role: ["owner", "admin", "manager", "seller"],
      assembly_status: [
        "pending",
        "scheduled",
        "in_progress",
        "done",
        "cancelled",
        "completed",
      ],
      business_type: ["interiores", "generico"],
      cash_register_status: ["open", "closed"],
      delivery_status: [
        "pending",
        "scheduled",
        "out_for_delivery",
        "delivered",
        "failed",
        "cancelled",
        "assigned",
      ],
      fiscal_doc_status: [
        "pending",
        "authorized",
        "rejected",
        "cancelled",
        "denied",
        "contingency",
        "issued",
        "processing",
        "completed",
      ],
      fiscal_doc_type: ["nfe", "nfce", "nfse", "mdfe"],
      inventory_movement_type: [
        "purchase",
        "sale",
        "return_in",
        "return_out",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "loss",
      ],
      payable_status: ["open", "partial", "paid", "overdue", "cancelled"],
      payment_method: [
        "cash",
        "pix",
        "debit",
        "credit",
        "crediario",
        "store_credit",
        "transfer",
        "mp_pix",
        "mp_point",
        "card",
        "financeira",
      ],
      purchase_order_status: [
        "draft",
        "sent",
        "partial",
        "received",
        "cancelled",
        "requested",
      ],
      quote_status: [
        "open",
        "accepted",
        "converted",
        "expired",
        "cancelled",
        "draft",
        "sent",
      ],
      receivable_status: ["open", "partial", "paid", "overdue", "cancelled"],
      sale_status: [
        "draft",
        "held",
        "paid",
        "cancelled",
        "returned",
        "crediario",
        "open",
      ],
      transfer_status: ["draft", "sent", "received", "cancelled"],
    },
  },
} as const
