import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ACCOUNT_ID = '00000000-0000-4000-a000-000000000001';
const STORE_ID = '00000000-0000-4000-a000-000000000002';
const TEMP_PASSWORD = 'Typos@2026';

const csv = fs.readFileSync('/tmp/leona_vendedores.csv', 'utf8').trim().split('\n');
const headers = csv[0].split(',');
const rows = csv.slice(1).map(line => {
  const v = line.split(',');
  return Object.fromEntries(headers.map((h, i) => [h, v[i]]));
});

const results = [];
for (const row of rows) {
  const { role, is_active, full_name, email } = row;
  const active = is_active === 'True';
  try {
    // Try to find existing user
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        password: TEMP_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) throw error;
      user = created.user;
    }

    // Upsert profile
    await supabase.from('profiles').upsert({
      user_id: user.id,
      email,
      full_name,
      display_name: full_name,
    }, { onConflict: 'user_id' });

    // Upsert membership
    await supabase.from('memberships').upsert({
      account_id: ACCOUNT_ID,
      user_id: user.id,
      role,
      is_active: active,
    }, { onConflict: 'account_id,user_id' });

    // Store membership (only for sellers/managers/owner)
    await supabase.from('store_memberships').upsert({
      account_id: ACCOUNT_ID,
      store_id: STORE_ID,
      user_id: user.id,
      is_active: active,
    }, { onConflict: 'store_id,user_id' });

    results.push({ email, full_name, role, user_id: user.id, status: 'ok' });
  } catch (e) {
    results.push({ email, status: 'error', error: e.message });
  }
}
console.log(JSON.stringify(results, null, 2));
