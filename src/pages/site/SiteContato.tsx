import { SiteLayout } from '@/components/site/SiteLayout';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { MapPin, Phone, Mail, Clock, Instagram, Facebook } from 'lucide-react';

export default function SiteContato() {
  const { data: s } = useSiteSettings();
  const addr = encodeURIComponent(s?.address || '');
  return (
    <SiteLayout>
      <section className="bg-gradient-to-b from-[#3a0a0a] to-[#1a0303] text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-[#d4a574]">Fale conosco</span>
          <h1 className="text-5xl md:text-6xl font-light mt-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Visite nossa loja
          </h1>
        </div>
      </section>

      <section className="py-20 bg-[#fbf8f4]">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            {[
              { icon: MapPin, t: 'Endereço', v: s?.address },
              { icon: Phone, t: 'Telefone', v: s?.phone },
              { icon: Mail, t: 'E-mail', v: s?.email },
              { icon: Clock, t: 'Horário de Atendimento', v: [s?.hours_weekdays, s?.hours_saturday, s?.hours_sunday].filter(Boolean).join('\n') },
            ].map((c) => (
              <div key={c.t} className="flex gap-4 p-6 bg-white border border-[#7a1818]/10">
                <div className="h-12 w-12 grid place-items-center rounded-full bg-[#7a1818]/10 text-[#7a1818] shrink-0">
                  <c.icon size={20} />
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-[#7a1818] font-semibold mb-1">{c.t}</h3>
                  <p className="text-[#1a0808]/80 whitespace-pre-line">{c.v}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              {s?.show_instagram && s?.instagram_url && (
                <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="h-12 w-12 grid place-items-center rounded-full bg-[#7a1818] text-white hover:bg-[#5a1010]">
                  <Instagram size={18} />
                </a>
              )}
              {s?.show_facebook && s?.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="h-12 w-12 grid place-items-center rounded-full bg-[#7a1818] text-white hover:bg-[#5a1010]">
                  <Facebook size={18} />
                </a>
              )}
            </div>
          </div>
          <div className="min-h-[420px] bg-[#3a0a0a]">
            {addr && (
              <iframe
                title="Mapa"
                src={`https://www.google.com/maps?q=${addr}&output=embed`}
                className="w-full h-full min-h-[420px] border-0"
                loading="lazy"
              />
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
