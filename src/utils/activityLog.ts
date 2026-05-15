import { supabase } from '@/integrations/supabase/client';

interface LogActivityParams {
  accountId: string;
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function logActivity({
  accountId,
  userId,
  userName,
  action,
  entityType,
  entityId,
  details,
}: LogActivityParams) {
  try {
    await supabase.from('activity_logs' as any).insert({
      account_id: accountId,
      user_id: userId,
      user_name: userName || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: details || null,
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}
