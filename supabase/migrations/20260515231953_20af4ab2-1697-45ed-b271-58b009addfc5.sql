-- =====================================================================
-- DISARAH INTERIORES — MIGRATION ÚNICA FASE 7
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. ENUMS
CREATE TYPE public.app_role AS ENUM ('owner','admin','manager','seller');
CREATE TYPE public.business_type AS ENUM ('interiores','generico');
CREATE TYPE public.sale_status AS ENUM ('draft','held','paid','cancelled','returned');
CREATE TYPE public.payment_method AS ENUM ('cash','pix','debit','credit','crediario','store_credit','transfer','mp_pix','mp_point');
CREATE TYPE public.fiscal_doc_type AS ENUM ('nfe','nfce','nfse','mdfe');
CREATE TYPE public.fiscal_doc_status AS ENUM ('pending','authorized','rejected','cancelled','denied','contingency');
CREATE TYPE public.inventory_movement_type AS ENUM ('purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','loss');
CREATE TYPE public.delivery_status AS ENUM ('pending','scheduled','out_for_delivery','delivered','failed','cancelled');
CREATE TYPE public.assembly_status AS ENUM ('pending','scheduled','in_progress','done','cancelled');
CREATE TYPE public.purchase_order_status AS ENUM ('draft','sent','partial','received','cancelled');
CREATE TYPE public.transfer_status AS ENUM ('draft','sent','received','cancelled');
CREATE TYPE public.quote_status AS ENUM ('open','accepted','converted','expired','cancelled');
CREATE TYPE public.receivable_status AS ENUM ('open','partial','paid','overdue','cancelled');
CREATE TYPE public.payable_status AS ENUM ('open','partial','paid','overdue','cancelled');
CREATE TYPE public.cash_register_status AS ENUM ('open','closed');

-- 3. CORE FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_account_id() RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT '00000000-0000-4000-a000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION public.current_store_id() RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT '00000000-0000-4000-a000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 4. TENANCY
CREATE TABLE public.accounts (id uuid PRIMARY KEY, name text NOT NULL, business_type public.business_type NOT NULL DEFAULT 'interiores', owner_pin_hash text, menu_theme text DEFAULT 'party', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, display_name text, email text, phone text, avatar_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL DEFAULT 'seller', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (account_id, user_id));
CREATE TABLE public.stores (id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, name text NOT NULL, legal_name text, cnpj text, ie text, im text, cnae text, tax_regime text, email text, phone text, zip text, street text, number text, complement text, district text, city text, state text, country text DEFAULT 'BR', logo_url text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.store_memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (store_id, user_id));

CREATE OR REPLACE FUNCTION public.has_account_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND role = _role AND is_active = true AND account_id = public.current_account_id()) $$;
CREATE OR REPLACE FUNCTION public.is_account_member(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND is_active = true AND account_id = public.current_account_id()) $$;

-- 5. CATALOG
CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL, name text NOT NULL, slug text, sort_order int DEFAULT 0, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, name text NOT NULL, legal_name text, doc text, ie text, email text, phone text, zip text, street text, number text, complement text, district text, city text, state text, notes text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, sku text, gtin text, name text NOT NULL, description text, category text, subcategory text, brand text, supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL, unit text DEFAULT 'UN', price_default numeric(14,2) NOT NULL DEFAULT 0, promo_price numeric(14,2), promo_starts_at timestamptz, promo_ends_at timestamptz, cost numeric(14,2) DEFAULT 0, weight_kg numeric(10,3), width_cm numeric(10,2), height_cm numeric(10,2), depth_cm numeric(10,2), ncm text, cest text, cfop text, origin text, icms_cst text, icms_aliquota numeric(6,2), pis_cst text, cofins_cst text, ipi_cst text, fiscal_unit text, cover_image_url text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (account_id, sku));
CREATE INDEX products_name_trgm ON public.products USING gin (name gin_trgm_ops);
CREATE TABLE public.product_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, url text NOT NULL, sort_order int DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, sku text, gtin text, price numeric(14,2), cost numeric(14,2), attributes jsonb NOT NULL DEFAULT '{}'::jsonb, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_variant_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE, url text NOT NULL, sort_order int DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_presentations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, name text NOT NULL, factor numeric(14,4) NOT NULL DEFAULT 1, price numeric(14,2), is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_price_tiers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, min_qty numeric(14,3) NOT NULL, price numeric(14,2) NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_expiration_dates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE, store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE, lot text, expires_at date NOT NULL, qty numeric(14,3) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());

-- 6. INVENTORY
CREATE TABLE public.inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE, qty numeric(14,3) NOT NULL DEFAULT 0, reserved_qty numeric(14,3) NOT NULL DEFAULT 0, reorder_point numeric(14,3), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (store_id, product_id, variant_id));
CREATE TABLE public.inventory_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE, type public.inventory_movement_type NOT NULL, qty numeric(14,3) NOT NULL, unit_cost numeric(14,2), ref_table text, ref_id uuid, notes text, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now());

-- 7. CUSTOMERS
CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, name text NOT NULL, doc text, doc_type text, email text, phone text, birthday date, credit_limit numeric(14,2) NOT NULL DEFAULT 0, notes text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX customers_phone_idx ON public.customers (phone);
CREATE TABLE public.customer_addresses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE, label text, zip text, street text, number text, complement text, district text, city text, state text, is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 8. SALES / PDV
CREATE TABLE public.sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, seller_id uuid REFERENCES auth.users(id), sale_number bigint, status public.sale_status NOT NULL DEFAULT 'draft', subtotal numeric(14,2) NOT NULL DEFAULT 0, discount numeric(14,2) NOT NULL DEFAULT 0, freight numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, notes text, cancelled_reason text, cancelled_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sales_status_idx ON public.sales (status);
CREATE INDEX sales_created_idx ON public.sales (created_at DESC);
CREATE TABLE public.sale_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, unit_price numeric(14,2) NOT NULL, discount numeric(14,2) NOT NULL DEFAULT 0, cost_at_sale numeric(14,2), total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE, receivable_id uuid, method public.payment_method NOT NULL, amount numeric(14,2) NOT NULL, installments int DEFAULT 1, authorization_code text, metadata jsonb DEFAULT '{}'::jsonb, paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.held_sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, seller_id uuid REFERENCES auth.users(id), customer_id uuid REFERENCES public.customers(id), label text, cart_snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 9. CASH REGISTER
CREATE TABLE public.cash_registers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, operator_id uuid NOT NULL REFERENCES auth.users(id), status public.cash_register_status NOT NULL DEFAULT 'open', opening_amount numeric(14,2) NOT NULL DEFAULT 0, closing_amount numeric(14,2), expected_amount numeric(14,2), difference numeric(14,2), opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, notes text);
CREATE TABLE public.cash_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE, type text NOT NULL CHECK (type IN ('sangria','suprimento','despesa','outro')), amount numeric(14,2) NOT NULL, description text, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now());

-- 10. FINANCIAL / CREDIARIO
CREATE TABLE public.accounts_receivable (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, customer_id uuid REFERENCES public.customers(id), sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL, installment_no int, total_installments int, amount numeric(14,2) NOT NULL, paid_amount numeric(14,2) NOT NULL DEFAULT 0, due_date date NOT NULL, paid_at timestamptz, status public.receivable_status NOT NULL DEFAULT 'open', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.accounts_payable (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, supplier_id uuid REFERENCES public.suppliers(id), purchase_order_id uuid, description text, amount numeric(14,2) NOT NULL, paid_amount numeric(14,2) NOT NULL DEFAULT 0, due_date date NOT NULL, paid_at timestamptz, status public.payable_status NOT NULL DEFAULT 'open', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.credit_override_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE, requested_by uuid REFERENCES auth.users(id), amount numeric(14,2) NOT NULL, reason text, approved boolean, approved_by uuid REFERENCES auth.users(id), approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.store_credits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE, amount numeric(14,2) NOT NULL, used_amount numeric(14,2) NOT NULL DEFAULT 0, origin_sale_id uuid REFERENCES public.sales(id), reason text, expires_at date, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 11. FISCAL (Focus NFe)
CREATE TABLE public.focus_nfe_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, api_key_secret_id uuid, company_id text, environment text NOT NULL DEFAULT 'homologation', nfe_series int DEFAULT 1, nfce_series int DEFAULT 1, nfe_next_number int DEFAULT 1, nfce_next_number int DEFAULT 1, certificate_uploaded boolean NOT NULL DEFAULT false, certificate_expires_at date, csc_id text, csc_token text, email_default text, is_enabled boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (store_id));
COMMENT ON TABLE public.focus_nfe_settings IS 'Configurações Focus NFe (provedor fiscal). Edge function nfeio-webhook mantém o nome legado por compat com callback URL já registrado no Focus.';
CREATE TABLE public.fiscal_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL, customer_id uuid REFERENCES public.customers(id), doc_type public.fiscal_doc_type NOT NULL, status public.fiscal_doc_status NOT NULL DEFAULT 'pending', series int, number bigint, access_key text, protocol text, authorized_at timestamptz, cancelled_at timestamptz, cancellation_reason text, rejection_reason text, xml_url text, pdf_url text, total_amount numeric(14,2), raw_payload jsonb, raw_response jsonb, external_id text, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX fiscal_documents_key_idx ON public.fiscal_documents (access_key);
CREATE INDEX fiscal_documents_status_idx ON public.fiscal_documents (status);
CREATE TABLE public.fiscal_corrections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, fiscal_document_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE, correction_text text NOT NULL, sequence_no int NOT NULL DEFAULT 1, protocol text, status text NOT NULL DEFAULT 'pending', raw_response jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fiscal_invalidations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, doc_type public.fiscal_doc_type NOT NULL, series int NOT NULL, number_from bigint NOT NULL, number_to bigint NOT NULL, reason text NOT NULL, protocol text, status text NOT NULL DEFAULT 'pending', raw_response jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fiscal_xml_backups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, fiscal_document_id uuid REFERENCES public.fiscal_documents(id) ON DELETE CASCADE, storage_path text NOT NULL, size_bytes bigint, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fiscal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, supplier_id uuid REFERENCES public.suppliers(id), access_key text, number bigint, series int, issued_at timestamptz, total_amount numeric(14,2), status text NOT NULL DEFAULT 'received', xml_url text, raw_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fiscal_entry_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, fiscal_entry_id uuid NOT NULL REFERENCES public.fiscal_entries(id) ON DELETE CASCADE, product_id uuid REFERENCES public.products(id), description text, ncm text, cfop text, unit text, qty numeric(14,3) NOT NULL, unit_cost numeric(14,2) NOT NULL, total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.customer_returns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id), customer_id uuid REFERENCES public.customers(id), reason text, total_amount numeric(14,2) NOT NULL DEFAULT 0, fiscal_document_id uuid REFERENCES public.fiscal_documents(id), status text NOT NULL DEFAULT 'open', created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.return_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, customer_return_id uuid NOT NULL REFERENCES public.customer_returns(id) ON DELETE CASCADE, sale_item_id uuid REFERENCES public.sale_items(id), product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, unit_price numeric(14,2) NOT NULL, total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.supplier_returns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, supplier_id uuid NOT NULL REFERENCES public.suppliers(id), reason text, total_amount numeric(14,2) NOT NULL DEFAULT 0, fiscal_document_id uuid REFERENCES public.fiscal_documents(id), status text NOT NULL DEFAULT 'open', created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.supplier_return_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, supplier_return_id uuid NOT NULL REFERENCES public.supplier_returns(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, unit_cost numeric(14,2) NOT NULL, total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.mdfe_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, driver_name text, driver_doc text, vehicle_plate text, origin_state text, dest_state text, route jsonb, linked_nfes jsonb, status public.fiscal_doc_status NOT NULL DEFAULT 'pending', series int, number bigint, access_key text, protocol text, authorized_at timestamptz, closed_at timestamptz, cancelled_at timestamptz, cancellation_reason text, xml_url text, pdf_url text, raw_payload jsonb, raw_response jsonb, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.nfe_destination_manifest (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, access_key text NOT NULL, emitter_cnpj text, emitter_name text, total_amount numeric(14,2), issued_at timestamptz, manifest_event text, manifest_protocol text, manifested_at timestamptz, raw_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (store_id, access_key));

-- 12. PURCHASES
CREATE TABLE public.purchase_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, supplier_id uuid NOT NULL REFERENCES public.suppliers(id), order_number bigint, status public.purchase_order_status NOT NULL DEFAULT 'draft', total numeric(14,2) NOT NULL DEFAULT 0, expected_at date, received_at timestamptz, notes text, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.purchase_order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, qty_received numeric(14,3) NOT NULL DEFAULT 0, unit_cost numeric(14,2) NOT NULL, total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

-- 13. STORE TRANSFERS
CREATE TABLE public.store_transfers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, origin_store_id uuid NOT NULL REFERENCES public.stores(id), dest_store_id uuid NOT NULL REFERENCES public.stores(id), transfer_number bigint, status public.transfer_status NOT NULL DEFAULT 'draft', notes text, sent_at timestamptz, received_at timestamptz, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.store_transfer_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_transfer_id uuid NOT NULL REFERENCES public.store_transfers(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, qty_received numeric(14,3) NOT NULL DEFAULT 0, unit_cost numeric(14,2), created_at timestamptz NOT NULL DEFAULT now());

-- 14. QUOTES
CREATE TABLE public.quotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, customer_id uuid REFERENCES public.customers(id), seller_id uuid REFERENCES auth.users(id), quote_number bigint, status public.quote_status NOT NULL DEFAULT 'open', subtotal numeric(14,2) NOT NULL DEFAULT 0, discount numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, valid_until date, notes text, converted_sale_id uuid REFERENCES public.sales(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.quote_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty numeric(14,3) NOT NULL, unit_price numeric(14,2) NOT NULL, discount numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

-- 15. DELIVERIES / PICKING / ASSEMBLY
CREATE TABLE public.drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, name text NOT NULL, doc text, phone text, vehicle_plate text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE, customer_id uuid REFERENCES public.customers(id), driver_id uuid REFERENCES public.drivers(id), status public.delivery_status NOT NULL DEFAULT 'pending', scheduled_at timestamptz, delivered_at timestamptz, zip text, street text, number text, complement text, district text, city text, state text, contact_name text, contact_phone text, freight numeric(14,2) NOT NULL DEFAULT 0, notes text, tracking_token text UNIQUE, proof_photo_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.picking_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending', picker_id uuid REFERENCES auth.users(id), started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.picking_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, picking_order_id uuid NOT NULL REFERENCES public.picking_orders(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES public.products(id), variant_id uuid REFERENCES public.product_variants(id), qty_required numeric(14,3) NOT NULL, qty_picked numeric(14,3) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.assemblers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, name text NOT NULL, doc text, phone text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.assemblies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE, customer_id uuid REFERENCES public.customers(id), assembler_id uuid REFERENCES public.assemblers(id), status public.assembly_status NOT NULL DEFAULT 'pending', scheduled_at timestamptz, done_at timestamptz, notes text, proof_photo_url text, fee numeric(14,2) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 16. COMMISSIONS
CREATE TABLE public.seller_commission_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, seller_id uuid REFERENCES auth.users(id), category text, base_percent numeric(6,2) NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.commission_tiers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, goal_percent_min numeric(6,2) NOT NULL, goal_percent_max numeric(6,2), commission_percent numeric(6,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.commission_cycles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, seller_id uuid REFERENCES auth.users(id), period_start date NOT NULL, period_end date NOT NULL, total_sales numeric(14,2) NOT NULL DEFAULT 0, total_commission numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.commissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE, seller_id uuid REFERENCES auth.users(id), commission_cycle_id uuid REFERENCES public.commission_cycles(id), base_amount numeric(14,2) NOT NULL, percent numeric(6,2) NOT NULL, amount numeric(14,2) NOT NULL, paid boolean NOT NULL DEFAULT false, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 17. SALES GOALS
CREATE TABLE public.sales_goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE, seller_id uuid REFERENCES auth.users(id), period_start date NOT NULL, period_end date NOT NULL, target_amount numeric(14,2) NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.sales_goals_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, sales_goal_id uuid NOT NULL REFERENCES public.sales_goals(id) ON DELETE CASCADE, current_amount numeric(14,2) NOT NULL DEFAULT 0, percent numeric(6,2) NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());

-- 18. MERCADO PAGO
CREATE TABLE public.mp_connections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, access_token text NOT NULL, user_id text, public_key text, expires_at timestamptz, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (store_id));
CREATE TABLE public.mp_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE, sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL, mp_payment_id text, type text NOT NULL, status text NOT NULL, amount numeric(14,2) NOT NULL, qr_code text, qr_code_base64 text, external_reference text, raw_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 19. AUTH FLOWS / LOGS
CREATE TABLE public.email_verification_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, code_hash text NOT NULL, purpose text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX email_verification_email_idx ON public.email_verification_codes (email, purpose);
CREATE TABLE public.email_send_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE, to_email text NOT NULL, template text, subject text, status text NOT NULL DEFAULT 'sent', provider_id text, error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.activity_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, user_id uuid REFERENCES auth.users(id), user_name text, action text NOT NULL, entity_type text, entity_id uuid, details jsonb DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX activity_logs_account_idx ON public.activity_logs (account_id, created_at DESC);

-- 20. updated_at TRIGGERS
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','profiles','memberships','stores','store_memberships','categories','suppliers','products','product_variants','product_presentations','product_price_tiers','inventory','customers','customer_addresses','sales','held_sales','accounts_receivable','accounts_payable','store_credits','focus_nfe_settings','fiscal_documents','fiscal_entries','customer_returns','supplier_returns','mdfe_documents','nfe_destination_manifest','purchase_orders','store_transfers','quotes','drivers','deliveries','picking_orders','assemblers','assemblies','seller_commission_rules','commission_tiers','commission_cycles','commissions','sales_goals','mp_connections','mp_payments']
  LOOP EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t); END LOOP;
END $$;

-- 21. SALE NUMBERING + INVENTORY TRIGGERS
CREATE SEQUENCE IF NOT EXISTS public.sales_number_seq START 1;
CREATE OR REPLACE FUNCTION public.assign_sale_number() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.sale_number IS NULL THEN NEW.sale_number := nextval('public.sales_number_seq'); END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_sales_assign_number BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.assign_sale_number();

CREATE OR REPLACE FUNCTION public.sales_status_inventory() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    FOR r IN SELECT * FROM public.sale_items WHERE sale_id = NEW.id LOOP
      INSERT INTO public.inventory_movements (account_id, store_id, product_id, variant_id, type, qty, unit_cost, ref_table, ref_id) VALUES (NEW.account_id, NEW.store_id, r.product_id, r.variant_id, 'sale', -r.qty, r.cost_at_sale, 'sales', NEW.id);
      INSERT INTO public.inventory (account_id, store_id, product_id, variant_id, qty) VALUES (NEW.account_id, NEW.store_id, r.product_id, r.variant_id, -r.qty)
      ON CONFLICT (store_id, product_id, variant_id) DO UPDATE SET qty = public.inventory.qty - r.qty, updated_at = now();
    END LOOP;
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'paid' THEN
    FOR r IN SELECT * FROM public.sale_items WHERE sale_id = NEW.id LOOP
      INSERT INTO public.inventory_movements (account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id) VALUES (NEW.account_id, NEW.store_id, r.product_id, r.variant_id, 'return_in', r.qty, 'sales', NEW.id);
      UPDATE public.inventory SET qty = qty + r.qty, updated_at = now() WHERE store_id = NEW.store_id AND product_id = r.product_id AND COALESCE(variant_id::text,'') = COALESCE(r.variant_id::text,'');
    END LOOP;
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sales_status_inventory BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_status_inventory();

-- 22. AUTH USER PROVISIONING
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc uuid := public.current_account_id(); store_uuid uuid := public.current_store_id(); is_first boolean; assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1))) ON CONFLICT (user_id) DO NOTHING;
  SELECT NOT EXISTS (SELECT 1 FROM public.memberships WHERE account_id = acc) INTO is_first;
  assigned_role := CASE WHEN is_first THEN 'owner'::public.app_role ELSE 'seller'::public.app_role END;
  INSERT INTO public.memberships (account_id, user_id, role, is_active) VALUES (acc, NEW.id, assigned_role, true) ON CONFLICT (account_id, user_id) DO NOTHING;
  INSERT INTO public.store_memberships (account_id, store_id, user_id, is_active) VALUES (acc, store_uuid, NEW.id, true) ON CONFLICT (store_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 23. RPCs
CREATE OR REPLACE FUNCTION public.generate_next_sku(prefix text DEFAULT 'SKU') RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\D','','g'),'')::int),0)+1 INTO n FROM public.products WHERE account_id = public.current_account_id(); RETURN prefix || lpad(n::text, 6, '0'); END $$;

CREATE OR REPLACE FUNCTION public.cancel_sale(sale_id uuid, reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.sales SET status = 'cancelled', cancelled_reason = reason, cancelled_at = now() WHERE id = sale_id AND account_id = public.current_account_id();
END $$;

CREATE OR REPLACE FUNCTION public.restore_inventory_for_item(item_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN SELECT si.*, s.store_id, s.account_id INTO r FROM public.sale_items si JOIN public.sales s ON s.id = si.sale_id WHERE si.id = item_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.inventory SET qty = qty + r.qty, updated_at = now() WHERE store_id = r.store_id AND product_id = r.product_id AND COALESCE(variant_id::text,'') = COALESCE(r.variant_id::text,'');
  INSERT INTO public.inventory_movements (account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id) VALUES (r.account_id, r.store_id, r.product_id, r.variant_id, 'return_in', r.qty, 'sale_items', item_id);
END $$;

CREATE OR REPLACE FUNCTION public.receive_crediario_installment(receivable_id uuid, amount numeric, method public.payment_method DEFAULT 'cash') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.accounts_receivable%ROWTYPE;
BEGIN IF NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.accounts_receivable WHERE id = receivable_id;
  UPDATE public.accounts_receivable SET paid_amount = paid_amount + amount, status = CASE WHEN paid_amount + amount >= amount THEN 'paid'::public.receivable_status ELSE 'partial'::public.receivable_status END, paid_at = CASE WHEN paid_amount + amount >= amount THEN now() ELSE paid_at END WHERE id = receivable_id;
  INSERT INTO public.payments (account_id, receivable_id, method, amount) VALUES (r.account_id, receivable_id, method, amount);
END $$;

CREATE OR REPLACE FUNCTION public.get_customer_used_credit(customer_id uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT COALESCE(SUM(amount - paid_amount), 0) FROM public.accounts_receivable WHERE customer_id = $1 AND status IN ('open','partial','overdue') AND account_id = public.current_account_id() $$;

CREATE OR REPLACE FUNCTION public.verify_account_pin(pin text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN SELECT owner_pin_hash INTO h FROM public.accounts WHERE id = public.current_account_id(); IF h IS NULL THEN RETURN false; END IF; RETURN h = crypt(pin, h); END $$;

CREATE OR REPLACE FUNCTION public.approve_credit_override_with_pin(request_id uuid, pin text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.verify_account_pin(pin) THEN RETURN false; END IF;
  UPDATE public.credit_override_requests SET approved = true, approved_by = auth.uid(), approved_at = now() WHERE id = request_id AND account_id = public.current_account_id();
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_tracking(token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT to_jsonb(d) - 'account_id' - 'created_by' FROM public.deliveries d WHERE tracking_token = token $$;

CREATE OR REPLACE FUNCTION public.reset_account_data(pin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc uuid := public.current_account_id();
BEGIN
  IF NOT public.has_account_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Only owner'; END IF;
  IF NOT public.verify_account_pin(pin) THEN RAISE EXCEPTION 'Invalid PIN'; END IF;
  DELETE FROM public.payments WHERE account_id = acc;
  DELETE FROM public.sale_items WHERE account_id = acc;
  DELETE FROM public.held_sales WHERE account_id = acc;
  DELETE FROM public.commissions WHERE account_id = acc;
  DELETE FROM public.sales WHERE account_id = acc;
  DELETE FROM public.inventory_movements WHERE account_id = acc;
  DELETE FROM public.accounts_receivable WHERE account_id = acc;
  DELETE FROM public.accounts_payable WHERE account_id = acc;
  DELETE FROM public.cash_movements WHERE account_id = acc;
  DELETE FROM public.cash_registers WHERE account_id = acc;
  DELETE FROM public.fiscal_corrections WHERE account_id = acc;
  DELETE FROM public.fiscal_invalidations WHERE account_id = acc;
  DELETE FROM public.fiscal_xml_backups WHERE account_id = acc;
  DELETE FROM public.return_notes WHERE account_id = acc;
  DELETE FROM public.customer_returns WHERE account_id = acc;
  DELETE FROM public.supplier_return_items WHERE account_id = acc;
  DELETE FROM public.supplier_returns WHERE account_id = acc;
  DELETE FROM public.fiscal_entry_items WHERE account_id = acc;
  DELETE FROM public.fiscal_entries WHERE account_id = acc;
  DELETE FROM public.fiscal_documents WHERE account_id = acc;
  DELETE FROM public.mdfe_documents WHERE account_id = acc;
  DELETE FROM public.deliveries WHERE account_id = acc;
  DELETE FROM public.picking_items WHERE account_id = acc;
  DELETE FROM public.picking_orders WHERE account_id = acc;
  DELETE FROM public.assemblies WHERE account_id = acc;
  DELETE FROM public.commission_cycles WHERE account_id = acc;
  DELETE FROM public.quote_items WHERE account_id = acc;
  DELETE FROM public.quotes WHERE account_id = acc;
  DELETE FROM public.purchase_order_items WHERE account_id = acc;
  DELETE FROM public.purchase_orders WHERE account_id = acc;
  DELETE FROM public.store_transfer_items WHERE account_id = acc;
  DELETE FROM public.store_transfers WHERE account_id = acc;
  DELETE FROM public.activity_logs WHERE account_id = acc;
  DELETE FROM public.mp_payments WHERE account_id = acc;
  UPDATE public.inventory SET qty = 0, reserved_qty = 0, updated_at = now() WHERE account_id = acc;
END $$;

-- 24. RLS
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','profiles','memberships','stores','store_memberships','categories','suppliers','products','product_images','product_variants','product_variant_images','product_presentations','product_price_tiers','product_expiration_dates','inventory','inventory_movements','customers','customer_addresses','sales','sale_items','payments','held_sales','cash_registers','cash_movements','accounts_receivable','accounts_payable','credit_override_requests','store_credits','focus_nfe_settings','fiscal_documents','fiscal_corrections','fiscal_invalidations','fiscal_xml_backups','fiscal_entries','fiscal_entry_items','customer_returns','return_notes','supplier_returns','supplier_return_items','mdfe_documents','nfe_destination_manifest','purchase_orders','purchase_order_items','store_transfers','store_transfer_items','quotes','quote_items','drivers','deliveries','picking_orders','picking_items','assemblers','assemblies','seller_commission_rules','commission_tiers','commission_cycles','commissions','sales_goals','sales_goals_progress','mp_connections','mp_payments','email_send_logs','activity_logs']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t); END LOOP;
END $$;
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_select ON public.accounts FOR SELECT TO authenticated USING (id = public.current_account_id() AND public.is_account_member(auth.uid()));
CREATE POLICY accounts_update_owner ON public.accounts FOR UPDATE TO authenticated USING (id = public.current_account_id() AND public.has_account_role(auth.uid(),'owner')) WITH CHECK (id = public.current_account_id() AND public.has_account_role(auth.uid(),'owner'));
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated USING (account_id = public.current_account_id() AND public.is_account_member(auth.uid()));
CREATE POLICY memberships_modify ON public.memberships FOR ALL TO authenticated USING (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin'))) WITH CHECK (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin')));
CREATE POLICY stores_select ON public.stores FOR SELECT TO authenticated USING (account_id = public.current_account_id() AND public.is_account_member(auth.uid()));
CREATE POLICY stores_modify ON public.stores FOR ALL TO authenticated USING (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin'))) WITH CHECK (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin')));
CREATE POLICY store_memberships_select ON public.store_memberships FOR SELECT TO authenticated USING (account_id = public.current_account_id() AND public.is_account_member(auth.uid()));
CREATE POLICY store_memberships_modify ON public.store_memberships FOR ALL TO authenticated USING (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin'))) WITH CHECK (account_id = public.current_account_id() AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin')));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['categories','suppliers','products','product_images','product_variants','product_variant_images','product_presentations','product_price_tiers','product_expiration_dates','inventory','inventory_movements','customers','customer_addresses','sales','sale_items','payments','held_sales','cash_registers','cash_movements','accounts_receivable','accounts_payable','credit_override_requests','store_credits','focus_nfe_settings','fiscal_documents','fiscal_corrections','fiscal_invalidations','fiscal_xml_backups','fiscal_entries','fiscal_entry_items','customer_returns','return_notes','supplier_returns','supplier_return_items','mdfe_documents','nfe_destination_manifest','purchase_orders','purchase_order_items','store_transfers','store_transfer_items','quotes','quote_items','drivers','deliveries','picking_orders','picking_items','assemblers','assemblies','seller_commission_rules','commission_tiers','commission_cycles','commissions','sales_goals','sales_goals_progress','mp_connections','mp_payments','email_send_logs','activity_logs']
  LOOP EXECUTE format('CREATE POLICY %I_all ON public.%I FOR ALL TO authenticated USING (account_id = public.current_account_id() AND public.is_account_member(auth.uid())) WITH CHECK (account_id = public.current_account_id() AND public.is_account_member(auth.uid()));', t, t); END LOOP;
END $$;

-- 24b. FOCUS NFE Vault helpers
CREATE OR REPLACE FUNCTION public.get_focus_nfe_api_key(p_store_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_secret_id uuid; v_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT api_key_secret_id INTO v_secret_id FROM public.focus_nfe_settings WHERE store_id = p_store_id AND account_id = public.current_account_id();
  IF v_secret_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE id = v_secret_id;
  RETURN v_key;
END $$;

CREATE OR REPLACE FUNCTION public.set_focus_nfe_api_key(p_store_id uuid, p_api_key text, p_pin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_secret_id uuid; v_secret_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.verify_account_pin(p_pin) THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  IF p_api_key IS NULL OR length(p_api_key) < 10 THEN RAISE EXCEPTION 'invalid_api_key'; END IF;
  SELECT api_key_secret_id INTO v_secret_id FROM public.focus_nfe_settings WHERE store_id = p_store_id AND account_id = public.current_account_id();
  v_secret_name := 'focus_nfe_api_key_' || p_store_id::text;
  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'Focus NFe API key');
    INSERT INTO public.focus_nfe_settings (account_id, store_id, api_key_secret_id, is_enabled) VALUES (public.current_account_id(), p_store_id, v_secret_id, true)
    ON CONFLICT (store_id) DO UPDATE SET api_key_secret_id = EXCLUDED.api_key_secret_id, is_enabled = true;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_api_key, v_secret_name, 'Focus NFe API key');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_focus_nfe_api_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_focus_nfe_api_key(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_focus_nfe_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_focus_nfe_api_key(uuid, text, text) TO authenticated;

-- 25. STORAGE BUCKETS + POLICIES
INSERT INTO storage.buckets (id, name, public) VALUES
  ('store-logos','store-logos',true),
  ('product-images','product-images',true),
  ('customer-avatars','customer-avatars',true),
  ('fiscal-xmls','fiscal-xmls',false),
  ('fiscal-pdfs','fiscal-pdfs',false),
  ('fiscal-certs','fiscal-certs',false),
  ('delivery-photos','delivery-photos',false),
  ('assembly-photos','assembly-photos',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY public_read_logos ON storage.objects FOR SELECT USING (bucket_id IN ('store-logos','product-images','customer-avatars'));
CREATE POLICY members_write_logos ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('store-logos','product-images','customer-avatars') AND public.is_account_member(auth.uid()));
CREATE POLICY members_update_logos ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('store-logos','product-images','customer-avatars') AND public.is_account_member(auth.uid()));
CREATE POLICY members_delete_logos ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('store-logos','product-images','customer-avatars') AND public.is_account_member(auth.uid()));
CREATE POLICY members_all_private ON storage.objects FOR ALL TO authenticated USING (bucket_id IN ('fiscal-xmls','fiscal-pdfs','delivery-photos','assembly-photos') AND public.is_account_member(auth.uid())) WITH CHECK (bucket_id IN ('fiscal-xmls','fiscal-pdfs','delivery-photos','assembly-photos') AND public.is_account_member(auth.uid()));
CREATE POLICY admin_all_certs ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'fiscal-certs' AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin'))) WITH CHECK (bucket_id = 'fiscal-certs' AND (public.has_account_role(auth.uid(),'owner') OR public.has_account_role(auth.uid(),'admin')));

-- 26. SEED DISARAH
INSERT INTO public.accounts (id, name, business_type, owner_pin_hash) VALUES ('00000000-0000-4000-a000-000000000001','Disarah Interiores','interiores',crypt('1234', gen_salt('bf')));
INSERT INTO public.stores (id, account_id, name, legal_name, cnpj, ie, im, cnae, tax_regime, email, phone, zip, street, number, complement, district, city, state, is_active)
VALUES ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001','Disarah Interiores','Disarah Interiores LTDA','00.000.000/0000-00','PREENCHER','PREENCHER','PREENCHER','simples_nacional', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);
INSERT INTO public.categories (account_id, name, sort_order) VALUES
  ('00000000-0000-4000-a000-000000000001','Sofás',1),
  ('00000000-0000-4000-a000-000000000001','Mesas',2),
  ('00000000-0000-4000-a000-000000000001','Cadeiras',3),
  ('00000000-0000-4000-a000-000000000001','Estantes e Racks',4),
  ('00000000-0000-4000-a000-000000000001','Camas e Colchões',5),
  ('00000000-0000-4000-a000-000000000001','Decoração',6),
  ('00000000-0000-4000-a000-000000000001','Iluminação',7),
  ('00000000-0000-4000-a000-000000000001','Tapetes',8);
