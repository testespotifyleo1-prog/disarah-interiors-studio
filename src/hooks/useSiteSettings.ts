import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SiteSettings = {
  id: string;
  brand_name: string;
  tagline: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_title: string | null;
  about_text: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  hours_weekdays: string | null;
  hours_saturday: string | null;
  hours_sunday: string | null;
  show_facebook: boolean;
  show_instagram: boolean;
  primary_color: string | null;
};

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site_settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SiteSettings | null;
    },
    staleTime: 60_000,
  });
}
