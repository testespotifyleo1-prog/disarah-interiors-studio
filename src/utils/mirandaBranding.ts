/**
 * Branding compartilhado "Miranda Móveis".
 *
 * As lojas JP MOVEIS, MIRANDA E FARIAS e MIRANDA E MIRANDA pertencem ao
 * mesmo grupo comercial e, nos documentos impressos (PDF), devem aparecer
 * apenas como "Miranda Móveis" — preservando o endereço e telefone próprios
 * da loja emissora. Também ocultamos o rótulo "Razão Social:".
 */

const MIRANDA_PATTERNS = [
  /jp\s*m[oó]veis/i,
  /miranda\s*e\s*farias/i,
  /miranda\s*e\s*miranda/i,
];

export function isMirandaGroupStore(storeName?: string | null): boolean {
  if (!storeName) return false;
  return MIRANDA_PATTERNS.some((re) => re.test(storeName));
}

/** Nome a ser exibido no PDF para essas lojas. */
export const MIRANDA_DISPLAY_NAME = "Miranda Móveis";

/** Devolve o nome a usar no PDF (substitui pelo branding quando aplicável). */
export function getStoreDisplayName(storeName?: string | null): string {
  if (isMirandaGroupStore(storeName)) return MIRANDA_DISPLAY_NAME;
  return storeName || "Loja";
}
