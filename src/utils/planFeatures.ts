/**
 * Plan-based feature gating utility.
 * 
 * RULE: Accounts WITHOUT a plan (plan_id = null) are legacy accounts
 * and have FULL ACCESS to everything. Only NEW accounts with an assigned
 * plan are subject to feature restrictions.
 */

export type PlanFeature =
  | 'pdv'
  | 'pdv_rapido'
  | 'products'
  | 'categories'
  | 'product_groups'
  | 'variants'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'sales'
  | 'cash_register'
  | 'finance_basic'
  | 'crediario'
  | 'fiscal_basic'
  | 'reports_basic'
  | 'sellers'
  | 'quotes'
  | 'purchase_orders'
  | 'replenishment'
  | 'store_transfers'
  | 'commissions'
  | 'returns'
  | 'reports_advanced'
  | 'fiscal_entries'
  | 'import_export'
  | 'labels'
  | 'multi_store'
  | 'priority_support'
  | 'whatsapp_chatbot'
  | 'ecommerce'
  | 'logistics'
  | 'assemblies'
  | 'ai_simulation'
  | 'max_support';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  max_users: number;
  max_stores: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  ai_credits_monthly?: number | null;
  landing_highlights?: string[] | null;
  is_featured?: boolean;
  landing_cta_label?: string | null;
  landing_subtitle?: string | null;
}

/**
 * Catálogo central de TODAS as funcionalidades do sistema com label legível
 * e categoria. Usado pelo editor de planos no Super Admin.
 */
export const FEATURE_CATALOG: Array<{
  key: PlanFeature;
  label: string;
  category: string;
  description?: string;
}> = [
  // Operação
  { key: 'pdv', label: 'PDV Completo', category: 'Operação' },
  { key: 'pdv_rapido', label: 'PDV Rápido', category: 'Operação' },
  { key: 'cash_register', label: 'Caixa / Sangria / Reforço', category: 'Operação' },
  { key: 'sales', label: 'Vendas e Histórico', category: 'Operação' },
  { key: 'returns', label: 'Devoluções', category: 'Operação' },
  // Catálogo
  { key: 'products', label: 'Produtos', category: 'Catálogo' },
  { key: 'categories', label: 'Categorias', category: 'Catálogo' },
  { key: 'product_groups', label: 'Grupos de Produtos', category: 'Catálogo' },
  { key: 'variants', label: 'Variações de Produtos', category: 'Catálogo' },
  { key: 'inventory', label: 'Estoque & Validades', category: 'Catálogo' },
  { key: 'labels', label: 'Etiquetas Térmicas', category: 'Catálogo' },
  // Pessoas
  { key: 'customers', label: 'Clientes', category: 'Pessoas' },
  { key: 'suppliers', label: 'Fornecedores', category: 'Pessoas' },
  { key: 'sellers', label: 'Vendedores', category: 'Pessoas' },
  { key: 'commissions', label: 'Comissões por Faixa', category: 'Pessoas' },
  // Financeiro
  { key: 'finance_basic', label: 'Financeiro (Contas a Pagar/Receber)', category: 'Financeiro' },
  { key: 'crediario', label: 'Crediário & Crédito de Loja', category: 'Financeiro' },
  // Comercial
  { key: 'quotes', label: 'Orçamentos & Pré-Vendas', category: 'Comercial' },
  { key: 'purchase_orders', label: 'Pedidos de Compra', category: 'Comercial' },
  { key: 'replenishment', label: 'Sugestão de Reposição', category: 'Comercial' },
  { key: 'store_transfers', label: 'Transferências entre Lojas', category: 'Comercial' },
  // Fiscal
  { key: 'fiscal_basic', label: 'Fiscal Básico (NFC-e)', category: 'Fiscal' },
  { key: 'fiscal_entries', label: 'Entradas Fiscais (NF-e)', category: 'Fiscal' },
  // Multi-loja & Relatórios
  { key: 'multi_store', label: 'Multi-loja', category: 'Relatórios' },
  { key: 'reports_basic', label: 'Relatórios Básicos', category: 'Relatórios' },
  { key: 'reports_advanced', label: 'Relatórios Avançados', category: 'Relatórios' },
  // Logística
  { key: 'logistics', label: 'Logística & Entregas', category: 'Logística' },
  { key: 'assemblies', label: 'Montagens', category: 'Logística' },
  // Premium
  { key: 'whatsapp_chatbot', label: 'WhatsApp + Chatbot IA', category: 'Premium' },
  { key: 'ecommerce', label: 'Loja Virtual / E-commerce', category: 'Premium' },
  { key: 'ai_simulation', label: 'Simulação Inteligente IA', category: 'Premium' },
  { key: 'import_export', label: 'Importação CSV/Excel em massa', category: 'Premium' },
  // Suporte
  { key: 'priority_support', label: 'Suporte Prioritário', category: 'Suporte' },
  { key: 'max_support', label: 'Suporte Máximo (24/7)', category: 'Suporte' },
];

export const FEATURE_LABELS: Record<PlanFeature, string> = FEATURE_CATALOG.reduce(
  (acc, f) => ({ ...acc, [f.key]: f.label }),
  {} as Record<PlanFeature, string>
);

/**
 * Check if a feature is available for the current account's plan.
 * Legacy accounts (no plan) always return true.
 */
export function hasPlanFeature(
  plan: Plan | null | undefined,
  feature: PlanFeature
): boolean {
  // No plan = legacy account = full access
  if (!plan) return true;
  return (plan.features as string[]).includes(feature);
}

/**
 * Maps sidebar routes to required plan features.
 */
export const ROUTE_FEATURE_MAP: Record<string, PlanFeature> = {
  '/app/pdv': 'pdv',
  '/app/ai-simulations': 'ai_simulation',
  '/app/pdv-rapido': 'pdv_rapido',
  '/app/products': 'products',
  '/app/categories': 'categories',
  '/app/inventory': 'inventory',
  '/app/customers': 'customers',
  '/app/suppliers': 'suppliers',
  '/app/sales': 'sales',
  '/app/caixa': 'cash_register',
  '/app/finance': 'finance_basic',
  '/app/crediario': 'crediario',
  '/app/store-credits': 'crediario',
  '/app/sellers': 'sellers',
  '/app/my-commissions': 'sellers',
  '/app/labels': 'labels',
  '/app/expiration-report': 'inventory',
  '/app/quotes': 'quotes',
  '/app/purchase-orders': 'purchase_orders',
  '/app/replenishment': 'replenishment',
  '/app/transfers': 'store_transfers',
  '/app/commission-tiers': 'commissions',
  '/app/fiscal-returns': 'returns',
  '/app/supplier-returns': 'returns',
  '/app/fiscal-entries': 'fiscal_entries',
  '/app/settings/fiscal': 'fiscal_basic',
  '/app/fiscal-counter': 'fiscal_basic',
  '/app/drivers': 'logistics',
  '/app/deliveries': 'logistics',
  '/app/assemblers': 'assemblies',
  '/app/assemblies': 'assemblies',
  '/app/chat': 'whatsapp_chatbot',
  '/app/chatbot-settings': 'whatsapp_chatbot',
  '/app/ecommerce': 'ecommerce',
  '/app/integrations': 'ecommerce',
  '/app/products/import': 'import_export',
  '/app/customers/import': 'import_export',
  '/app/suppliers/import': 'import_export',
};

/**
 * Maps sidebar menu group IDs to required plan features.
 * If ANY feature in the array is available, the group is shown.
 */
export const GROUP_FEATURE_MAP: Record<string, PlanFeature[]> = {
  logistics: ['logistics', 'assemblies'],
  chat: ['whatsapp_chatbot'],
  commercial: ['quotes', 'purchase_orders', 'replenishment'],
};
