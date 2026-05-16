import { supabase } from '@/integrations/supabase/client';

export const SITE_BUCKET = 'site-photos';

export function sitePhotoUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from(SITE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadSitePhoto(file: File, folder = 'gallery') {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(SITE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}
