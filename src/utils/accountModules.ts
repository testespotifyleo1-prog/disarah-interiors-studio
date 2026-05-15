// Single-tenant ERP (Disarah Interiores): no per-account module gating.
// Empty map keeps the API surface but disables nothing.
const DISABLED_MODULES: Record<string, string[]> = {};

/** Mensagem padrão exibida quando um recurso de IA está bloqueado para a conta. */
export const AI_BLOCKED_MESSAGE =
  'Recurso de IA indisponível para esta conta. Contate o suporte para ativar.';

/** Mensagem padrão exibida quando um módulo está bloqueado para a conta. */
export const MODULE_BLOCKED_MESSAGE =
  'Recurso bloqueado para esta conta. Contate a equipe Typos para ativar.';

/** Helper: indica se a conta está com recursos de IA bloqueados. */
export function isAiBlocked(
  accountOrId: string | { id?: string; business_type?: string | null } | null | undefined
): boolean {
  return isModuleDisabled(accountOrId, 'ai_features');
}

export type ModuleType =
  | 'assemblies'
  | 'crediario'
  | 'auto_delivery'
  | 'pdv_standard'
  | 'seller_no_edit_products'
  | 'hide_card_details_pdv'
  | 'assembly_fee'
  | 'ai_features'
  | 'integrations'
  | 'email_marketing'
  | 'api_access';

export type BusinessType = 'furniture' | 'party' | 'general';

// Módulos automaticamente desabilitados conforme o tipo de negócio.
// 'furniture' = nada desabilitado (default seguro).
const BUSINESS_TYPE_DISABLED: Record<BusinessType, ModuleType[]> = {
  furniture: [],
  party: ['assemblies', 'assembly_fee'],
  general: ['assemblies', 'assembly_fee'],
};

/**
 * Verifica se um módulo está desabilitado para a conta.
 * Combina as flags legadas (por accountId) com a regra de business_type.
 * Se o segundo argumento for objeto Account-like, lê o business_type dele.
 * Se for só o id (string), mantém compat com chamadas antigas.
 */
export function isModuleDisabled(
  accountOrId: string | { id?: string; business_type?: string | null } | null | undefined,
  module: ModuleType
): boolean {
  if (!accountOrId) return false;

  const id = typeof accountOrId === 'string' ? accountOrId : accountOrId?.id;
  const businessType = (
    typeof accountOrId === 'object' ? (accountOrId?.business_type as BusinessType | undefined) : undefined
  );

  // 1) Flag legada por accountId
  if (id && DISABLED_MODULES[id]?.includes(module)) return true;

  // 2) Regra por business_type
  if (businessType && BUSINESS_TYPE_DISABLED[businessType]?.includes(module)) return true;

  return false;
}

export function isModuleEnabled(
  accountOrId: string | { id?: string; business_type?: string | null } | null | undefined,
  module: ModuleType
): boolean {
  return !isModuleDisabled(accountOrId, module);
}

/**
 * Helper para a UI: retorna true se a conta deve esconder tudo que é
 * relacionado a montagem (módulo, taxa, agendamento, etc).
 */
export function shouldHideAssembly(
  account: { id?: string; business_type?: string | null } | null | undefined
): boolean {
  return isModuleDisabled(account, 'assemblies');
}
