// IDs de contas que não utilizam certos módulos (flags legadas hardcoded)
// MANTIDO para 100% compatibilidade com lógica anterior.
const DISABLED_MODULES: Record<string, string[]> = {
  // Ponto da Festa - loja de artigos para festas
  '2480b8ae-c3a4-4a39-ad76-e6b41013f25e': ['assemblies', 'auto_delivery', 'seller_no_edit_products', 'hide_card_details_pdv'],
  // TOP FESTAS / Conecta Mix Top Festas
  '794d95b6-15e2-4ada-8aea-32998477f235': ['assemblies', 'auto_delivery', 'seller_no_edit_products', 'hide_card_details_pdv'],
  // Disarah Interiores + Depósito (recursos de IA, crediário, marketplaces, e-mail marketing e API bloqueados)
  '383878d2-142b-4df6-94ce-875f6458413e': ['ai_features', 'crediario', 'integrations', 'email_marketing', 'api_access'],
  // DISARAH (segunda conta - Depósito da Empresa)
  '2a8b5291-4820-49e0-8943-e6ce7056708e': ['ai_features', 'crediario', 'integrations', 'email_marketing', 'api_access'],
};

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
