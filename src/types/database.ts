// Application types derived from database schema

export type AccountRole = 'owner' | 'admin' | 'manager' | 'seller';
export type StoreRole = 'admin' | 'manager' | 'seller';
export type SaleStatus = 'draft' | 'open' | 'paid' | 'canceled' | 'crediario';
export type PaymentMethod = 'pix' | 'cash' | 'card' | 'crediario' | 'financeira' | 'store_credit';
export type CardType = 'debit' | 'credit';
export type CommissionStatus = 'pending' | 'paid' | 'canceled';
export type DeliveryType = 'pickup' | 'delivery';
export type DeliveryStatus = 'pending' | 'assigned' | 'out_for_delivery' | 'delivered' | 'canceled';
export type AssemblyStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'canceled';
export type FiscalDocType = 'nfe' | 'nfce' | 'cupom' | 'nfse' | 'nfe_complementar';
export type NfeioEnvironment = 'prod' | 'homolog';
export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BusinessType = 'furniture' | 'party' | 'general';

export interface Account {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  owner_pin?: string | null;
  business_type?: BusinessType | null;
}

export interface Membership {
  id: string;
  account_id: string;
  user_id: string;
  role: AccountRole;
  is_active: boolean;
  created_at: string;
}

export interface Store {
  id: string;
  account_id: string;
  name: string;
  cnpj: string;
  ie?: string | null;
  address_json?: unknown;
  is_active: boolean;
  created_at: string;
  pix_key?: string | null;
  pix_key_type?: string | null;
  logo_path?: string | null;
  logo_updated_at?: string | null;
}

export interface StoreMembership {
  id: string;
  store_id: string;
  user_id: string;
  role_in_store: StoreRole;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  account_id: string;
  sku?: string;
  name: string;
  ncm?: string;
  cest?: string;
  cfop_default?: string;
  unit: string;
  gtin?: string;
  price_default: number;
  cost_default: number;
  is_active: boolean;
  created_at: string;
  image_url?: string | null;
  description?: string | null;
}

export interface Inventory {
  id: string;
  store_id: string;
  product_id: string;
  qty_on_hand: number;
  min_qty: number;
  updated_at: string;
}

export interface Customer {
  id: string;
  account_id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address_json?: unknown;
  credit_authorized: boolean;
  credit_limit: number;
  created_at: string;
}

export interface Sale {
  id: string;
  account_id: string;
  store_id: string;
  seller_id: string;
  customer_id?: string;
  sale_number?: number | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  canceled_by?: string | null;
  canceled_at?: string | null;
  cancel_reason?: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  total_line: number;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  card_type?: CardType;
  brand?: string;
  installments: number;
  card_fee_percent: number;
  card_fee_value: number;
  paid_value: number;
  created_at: string;
}

export interface SellerCommissionRule {
  id: string;
  account_id: string;
  seller_id: string;
  percent_default: number;
  is_active: boolean;
  created_at: string;
}

export interface Commission {
  id: string;
  sale_id: string;
  seller_id: string;
  percent: number;
  value: number;
  status: CommissionStatus;
  created_at: string;
}

export interface Driver {
  id: string;
  account_id: string;
  store_id?: string;
  name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Delivery {
  id: string;
  sale_id: string;
  account_id: string;
  store_id: string;
  driver_id?: string | null;
  delivery_type: DeliveryType;
  address_json?: unknown;
  eta_minutes?: number | null;
  eta_at?: string | null;
  status: DeliveryStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  drivers?: { name: string; phone?: string | null } | null;
}

export interface NfeioSettings {
  id: string;
  store_id: string;
  api_key: string;
  company_id?: string | null;
  environment: NfeioEnvironment;
  webhook_secret?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FiscalDocument {
  id: string;
  sale_id: string;
  store_id: string;
  type: FiscalDocType;
  provider: string;
  provider_id?: string;
  status: string;
  pdf_url?: string;
  xml_url?: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type?: string;
  payload_json: Record<string, unknown>;
  received_at: string;
  processed_at?: string;
  status: string;
}

export interface ImportJob {
  id: string;
  account_id: string;
  user_id: string;
  status: ImportJobStatus;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  created_at: string;
}

export interface ImportJobError {
  id: string;
  job_id: string;
  row_number: number;
  message: string;
  row_data_json?: Record<string, unknown>;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountPayable {
  id: string;
  account_id: string;
  store_id?: string | null;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  status: string;
  payment_method?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  supplier_name?: string | null;
  created_at: string;
}

export interface AccountReceivable {
  id: string;
  account_id: string;
  store_id?: string | null;
  sale_id?: string | null;
  customer_id?: string | null;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  status: string;
  installment_number?: number | null;
  total_installments?: number | null;
  paid_at?: string | null;
  created_at: string;
}

export interface CreditOverrideRequest {
  id: string;
  account_id: string;
  store_id?: string | null;
  sale_id?: string | null;
  customer_id: string;
  requested_by: string;
  requested_at: string;
  current_limit: number;
  used_balance: number;
  sale_amount: number;
  excess_amount: number;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  denied_by?: string | null;
  denied_at?: string | null;
  authorization_type?: string | null;
  authorized_amount?: number | null;
  deny_reason?: string | null;
  created_at: string;
}

export interface CommissionCycle {
  id: string;
  account_id: string;
  seller_id: string;
  started_at: string;
  ended_at?: string | null;
  total_commission: number;
  status: string;
  paid_at?: string | null;
  paid_by?: string | null;
  created_at: string;
}

// Extended types with relations
export interface MembershipWithProfile extends Membership {
  profiles?: Profile;
}

export interface SaleWithDetails extends Sale {
  customers?: Customer;
  stores?: Store;
  sale_items?: (SaleItem & { products?: Product })[];
  payments?: Payment[];
  deliveries?: Delivery[];
  fiscal_documents?: FiscalDocument[];
}

export interface InventoryWithProduct extends Inventory {
  products?: Product;
}
