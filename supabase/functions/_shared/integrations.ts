// Helpers compartilhados pelas integrações Amazon / Magalu / Melhor Envio / Uber Direct
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getCallbackUrl(req: Request, fnName: string): string {
  const supaUrl = Deno.env.get('SUPABASE_URL');
  if (supaUrl) return `${supaUrl.replace(/\/$/, '')}/functions/v1/${fnName}`;
  const url = new URL(req.url);
  return `https://${req.headers.get('x-forwarded-host') || url.host}/functions/v1/${fnName}`;
}

export function encodeState(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeState<T = Record<string, unknown>>(state: string): T {
  const padded = state.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - state.length % 4) % 4);
  return JSON.parse(atob(padded));
}

export function redirectToApp(returnUrl: string, params: Record<string, string>) {
  const fallback = 'https://typoserp.com.br/app/integrations';
  let url: URL;
  try { url = new URL(returnUrl || fallback); } catch { url = new URL(fallback); }
  const allowed = url.hostname === 'typoserp.com.br' || url.hostname.endsWith('.lovable.app') || url.hostname === 'localhost';
  if (!allowed) url = new URL(fallback);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return Response.redirect(url.toString(), 302);
}
