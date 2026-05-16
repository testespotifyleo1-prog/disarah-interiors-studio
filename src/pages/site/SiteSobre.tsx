import { SiteLayout } from '@/components/site/SiteLayout';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import hero from '@/assets/disarah/hero2.jpg';

export default function SiteSobre() {
  const { data: s } = useSiteSettings();
  return (
    <SiteLayout>
      <section className="relative h-[50vh] flex items-center overflow-hidden">
        <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0303]/85 to-[#3a0a0a]/40" />
        <div className="relative max-w-7xl mx-auto px-6">
          <span className="text-xs uppercase tracking-[0.3em] text-[#d4a574]">A Disarah</span>
          <h1 className="text-5xl md:text-7xl font-light text-white mt-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {s?.about_title || 'Sobre nós'}
          </h1>
        </div>
      </section>

      <section className="py-24 bg-[#fbf8f4]">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-xl text-[#1a0808]/75 leading-[1.9] whitespace-pre-line font-light">
            {s?.about_text}
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
