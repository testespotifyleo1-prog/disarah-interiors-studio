import { supabase } from '@/integrations/supabase/client';

const IMP_SESSION_KEY = 'impersonate.original_session';
const IMP_META_KEY = 'impersonate.meta';

interface ImpersonateMeta {
  target_user_id: string;
  target_email: string;
  started_at: string;
  super_admin_email: string;
}

export function isImpersonating(): boolean {
  return !!localStorage.getItem(IMP_SESSION_KEY);
}

export function getImpersonateMeta(): ImpersonateMeta | null {
  const raw = localStorage.getItem(IMP_META_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Start impersonation: save current session, swap to target user.
 * Pass either target_user_id or account_id (resolves to owner).
 */
export async function startImpersonation(opts: { target_user_id?: string; account_id?: string }) {
  // Save original session
  const { data: { session: original } } = await supabase.auth.getSession();
  if (!original) throw new Error('Sessão atual inválida');

  // Call edge function (uses current session jwt automatically via supabase.functions.invoke)
  const { data, error } = await supabase.functions.invoke('impersonate-user', { body: opts });
  if (error) throw new Error(error.message || 'Falha ao iniciar impersonate');
  if (!data?.hashed_token || !data?.email) throw new Error('Resposta inválida da função');

  // Save original BEFORE switching
  localStorage.setItem(IMP_SESSION_KEY, JSON.stringify({
    access_token: original.access_token,
    refresh_token: original.refresh_token,
  }));

  // Verify magic link OTP → produces new session
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.hashed_token,
  });
  if (otpErr) {
    localStorage.removeItem(IMP_SESSION_KEY);
    throw otpErr;
  }

  localStorage.setItem(IMP_META_KEY, JSON.stringify({
    target_user_id: data.target_user_id,
    target_email: data.email,
    started_at: new Date().toISOString(),
    super_admin_email: '',
  } as ImpersonateMeta));

  // Clear scoped state to ensure clean reload as target user
  localStorage.removeItem('currentAccountId');
  localStorage.removeItem('currentStoreId');

  // Hard reload to /app/dashboard so all contexts reload
  window.location.href = '/app/dashboard';
}

/**
 * Stop impersonation: restore original super admin session.
 */
export async function stopImpersonation() {
  const raw = localStorage.getItem(IMP_SESSION_KEY);
  if (!raw) {
    window.location.href = '/superadmin';
    return;
  }
  const original = JSON.parse(raw) as { access_token: string; refresh_token: string };

  localStorage.removeItem(IMP_SESSION_KEY);
  localStorage.removeItem(IMP_META_KEY);
  localStorage.removeItem('currentAccountId');
  localStorage.removeItem('currentStoreId');

  const { error } = await supabase.auth.setSession({
    access_token: original.access_token,
    refresh_token: original.refresh_token,
  });
  if (error) {
    // Token expired — force logout
    await supabase.auth.signOut();
    window.location.href = '/login';
    return;
  }
  window.location.href = '/superadmin';
}
