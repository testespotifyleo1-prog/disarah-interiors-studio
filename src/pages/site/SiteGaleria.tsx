import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { SiteLayout } from '@/components/site/SiteLayout';
import { supabase } from '@/integrations/supabase/client';
import { sitePhotoUrl } from '@/utils/sitePhotos';

export default function SiteGaleria() {
  const { slug } = useParams();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['site_categories_active'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('site_categories').select('*').eq('is_active', true).order('sort_order');
      return data || [];
    },
  });

  const current = slug ? categories.find((c: any) => c.slug === slug) : null;

  const { data: photos = [] } = useQuery({
    queryKey: ['site_photos', current?.id || 'all'],
    enabled: !slug || !!current,
    queryFn: async () => {
      let q = (supabase as any).from('site_photos').select('*').eq('is_active', true).order('sort_order');
      if (current?.id) q = q.eq('category_id', current.id);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <SiteLayout>
      <section className="bg-gradient-to-b from-[#3a0a0a] to-[#1a0303] text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          {slug && (
            <Link to="/site/galeria" className="inline-flex items-center gap-2 text-[#d4a574] text-xs uppercase tracking-[0.2em] mb-6 hover:text-white">
              <ArrowLeft size={14} /> Todas categorias
            </Link>
          )}
          <h1 className="text-5xl md:text-6xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {current?.name || 'Galeria'}
          </h1>
          <p className="mt-3 text-white/70 max-w-xl">
            {current?.description || 'Explore nossa coleção de móveis cuidadosamente selecionados.'}
          </p>
        </div>
      </section>

      {!slug && (
        <section className="py-16 bg-[#fbf8f4]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {categories.map((cat: any) => (
                <Link key={cat.id} to={`/site/galeria/${cat.slug}`} className="group relative aspect-[3/4] overflow-hidden bg-[#1a0303] block">
                  {cat.cover_path ? (
                    <img src={sitePhotoUrl(cat.cover_path)} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3a0a0a] to-[#7a1818]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                    <h3 className="text-xl md:text-2xl font-medium" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{cat.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {slug && (
        <section className="py-16 bg-[#fbf8f4]">
          <div className="max-w-7xl mx-auto px-6">
            {photos.length === 0 ? (
              <p className="text-center text-[#1a0808]/60 py-20">Nenhuma foto cadastrada nesta categoria ainda.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((p: any, i: number) => (
                  <button
                    key={p.id}
                    onClick={() => setLightbox(i)}
                    className="group aspect-square overflow-hidden bg-[#3a0a0a]"
                  >
                    <img
                      src={sitePhotoUrl(p.image_path)}
                      alt={p.title || ''}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-6 right-6 text-white/80 hover:text-white p-2"><X size={28} /></button>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length); }}
            className="absolute left-6 text-white/80 hover:text-white p-2"
          ><ChevronLeft size={36} /></button>
          <img
            src={sitePhotoUrl(photos[lightbox].image_path)}
            alt={photos[lightbox].title || ''}
            className="max-h-[85vh] max-w-[85vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length); }}
            className="absolute right-6 text-white/80 hover:text-white p-2"
          ><ChevronRight size={36} /></button>
          {photos[lightbox].caption && (
            <p className="absolute bottom-6 left-0 right-0 text-center text-white/80 px-6">{photos[lightbox].caption}</p>
          )}
        </div>
      )}
    </SiteLayout>
  );
}
