import { supabase } from '@/integrations/supabase/client';

export const STORE_LOGO_BUCKET = 'store-assets';

export function getStoreLogoUrl(logoPath?: string | null, version?: string | null) {
  if (!logoPath) return null;

  const { data } = supabase.storage.from(STORE_LOGO_BUCKET).getPublicUrl(logoPath);
  if (!data.publicUrl) return null;

  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

export async function uploadStoreLogo(storeId: string, file: File) {
  const filePath = `${storeId}/logo`;

  const { error } = await supabase.storage
    .from(STORE_LOGO_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || 'image/png',
    });

  if (error) throw error;
  return filePath;
}

export async function fetchStoreLogoDataUrl(logoPath?: string | null, version?: string | null) {
  const publicUrl = getStoreLogoUrl(logoPath, version);
  if (!publicUrl) return null;

  const response = await fetch(publicUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a logomarca da loja.');

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao processar a logomarca da loja.'));
    reader.readAsDataURL(blob);
  });
}