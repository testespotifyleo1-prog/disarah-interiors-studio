import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Award, Heart, MapPin, Phone, Mail, Clock } from 'lucide-react';
import { SiteLayout } from '@/components/site/SiteLayout';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { sitePhotoUrl } from '@/utils/sitePhotos';
import hero1 from '@/assets/disarah/hero1.jpg';

export default function Site() {
  const { data: s } = useSiteSettings();

  const { data: categories = [] } = useQuery({
    queryKey: ['site_categories_active'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={s?.hero_image_url || hero1} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a0303]/85 via-[#3a0a0a]/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-2xl text-white">
            <span className="inline-flex items-center gap-2 text-[#d4a574] text-xs uppercase tracking-[0.3em] mb-6">
              <Sparkles size={14} /> {s?.tagline || 'Móveis selecionados'}
            </span>
            <h1
              className="text-5xl md:text-7xl font-light leading-[1.05] mb-6"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {s?.hero_title || 'Móveis com alma para a sua casa'}
            </h1>
            <p className="text-lg text-white/85 max-w-xl leading-relaxed mb-10">
              {s?.hero_subtitle ||
                'Peças selecionadas para criar ambientes acolhedores, sofisticados e únicos.'}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/site/galeria"
                className="group inline-flex items-center gap-2 bg-[#7a1818] hover:bg-[#5a1010] text-white px-8 py-4 rounded-none text-sm uppercase tracking-[0.18em] font-medium transition-all hover:gap-3"
              >
                Ver Galeria <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/site/contato"
                className="inline-flex items-center gap-2 border border-white/40 hover:bg-white hover:text-[#1a0303] text-white px-8 py-4 text-sm uppercase tracking-[0.18em] font-medium transition-all"
              >
                Visite a Loja
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="py-24 bg-[#fbf8f4]">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          {[
            { icon: Sparkles, t: 'Curadoria refinada', d: 'Cada peça é escolhida com olhar atento ao design, conforto e durabilidade.' },
            { icon: Award, t: 'Qualidade comprovada', d: 'Trabalhamos com marcas de confiança e acabamentos impecáveis.' },
            { icon: Heart, t: 'Atendimento próximo', d: 'Nossa equipe ajuda você a escolher os móveis ideais para o seu ambiente.' },
          ].map((f) => (
            <div key={f.t} className="text-center md:text-left">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#7a1818]/8 text-[#7a1818] mb-5">
                <f.icon size={24} />
              </div>
              <h3 className="text-2xl mb-3 font-medium" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{f.t}</h3>
              <p className="text-[#1a0808]/65 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIAS — Card Grid */}
      <section className="py-24 bg-[#f3ece2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-[0.3em] text-[#7a1818] font-semibold">Nossa Coleção</span>
            <h2 className="text-4xl md:text-5xl mt-4 font-light text-[#1a0303]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Explore por categoria
            </h2>
            <p className="mt-4 text-[#1a0808]/65 max-w-2xl mx-auto">
              Clique em uma categoria para ver as peças disponíveis.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {categories.map((cat: any) => (
              <Link
                key={cat.id}
                to={`/site/galeria/${cat.slug}`}
                className="group relative aspect-[3/4] overflow-hidden bg-[#1a0303] block"
              >
                {cat.cover_path ? (
                  <img
                    src={sitePhotoUrl(cat.cover_path)}
                    alt={cat.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#3a0a0a] to-[#7a1818]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                  <h3 className="text-xl md:text-2xl font-medium tracking-wide" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {cat.name}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs uppercase tracking-[0.15em] text-[#d4a574] opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver peças <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section className="py-24 bg-[#fbf8f4]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-[#7a1818] font-semibold">{s?.about_title || 'Sobre'}</span>
          <h2 className="text-4xl md:text-5xl mt-4 mb-6 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {s?.about_title || 'Sobre a Disarah'}
          </h2>
          <p className="text-lg text-[#1a0808]/70 leading-relaxed">
            {s?.about_text}
          </p>
        </div>
      </section>

      {/* CTA — Visite a loja */}
      <section className="py-20 bg-[#f3ece2] border-t border-[#7a1818]/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-[#7a1818] font-semibold">Venha nos visitar</span>
          <h2 className="text-3xl md:text-4xl mt-4 mb-4 font-light text-[#1a0303]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Conheça nosso showroom
          </h2>
          <p className="text-[#1a0808]/70 mb-8 max-w-xl mx-auto">
            Experimente cada peça pessoalmente. Nossa equipe está pronta para te receber.
          </p>
          <Link
            to="/site/contato"
            className="inline-flex items-center gap-2 bg-[#7a1818] hover:bg-[#5a1010] text-white px-8 py-4 text-sm uppercase tracking-[0.18em] font-medium transition-all hover:gap-3"
          >
            Ver endereço e horários <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
