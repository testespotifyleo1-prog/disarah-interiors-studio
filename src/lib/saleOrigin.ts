/**
 * Marcação TEMPORÁRIA de origem de venda.
 *
 * Contexto: enquanto a loja "JP MOVEIS" está com pendência fiscal, suas vendas
 * estão sendo faturadas dentro da loja "MIRANDA E FARIAS". Para conseguir
 * separar/relatar essas vendas sem quebrar nada (sem nova coluna, sem migração),
 * usamos uma tag dentro do campo `sales.notes`.
 *
 * Quando o problema for resolvido, basta esconder o seletor no PDV — o histórico
 * permanece consultável pelo filtro.
 */

export const JP_ORIGIN_TAG = "[ORIGEM:JP_MOVEIS]";

/** A loja ativa é a "Miranda e Farias" (única que recebe a marcação). */
export function isMirandaEFarias(storeName?: string | null): boolean {
  if (!storeName) return false;
  return /miranda\s*e\s*farias/i.test(storeName);
}

export function hasJpOrigin(notes?: string | null): boolean {
  if (!notes) return false;
  return notes.includes(JP_ORIGIN_TAG);
}

/** Adiciona/remove a tag preservando o restante das anotações do usuário. */
export function setJpOrigin(notes: string | null | undefined, enabled: boolean): string {
  const base = (notes ?? "").replace(JP_ORIGIN_TAG, "").trim();
  if (!enabled) return base;
  return base ? `${JP_ORIGIN_TAG} ${base}` : JP_ORIGIN_TAG;
}

/** Remove a tag das notas para exibição limpa ao usuário. */
export function stripJpOrigin(notes?: string | null): string {
  if (!notes) return "";
  return notes.replace(JP_ORIGIN_TAG, "").trim();
}
