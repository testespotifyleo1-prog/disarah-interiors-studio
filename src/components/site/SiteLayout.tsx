import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Mail, MapPin, Phone, Instagram, Facebook, Clock, LogIn } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { WhatsAppFloat } from './WhatsAppFloat';
import disarahLogo from '@/assets/disarah/logo.png';
import disarahLogoWhite from '@/assets/disarah/logo-white.png';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/site', label: 'Início' },
  { to: '/site/galeria', label: 'Galeria' },
  { to: '/site/sobre', label: 'Sobre' },
  { to: '/site/contato', label: 'Contato' },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const { data: s } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf8f4] text-[#1a0808]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#fbf8f4]/85 border-b border-[#7a1818]/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/site" className="flex items-center gap-3">
            <img src={s?.logo_url || disarahLogo} alt={s?.brand_name || 'Disarah Interiores'} style={{ height: `${s?.logo_size || 48}px` }} className="w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {nav.map((n) => {
              const active = loc.pathname === n.to || (n.to !== '/site' && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    'text-sm uppercase tracking-[0.18em] font-medium transition-colors relative py-2',
                    active ? 'text-[#7a1818]' : 'text-[#1a0808]/70 hover:text-[#7a1818]'
                  )}
                >
                  {n.label}
                  {active && <span className="absolute left-0 right-0 -bottom-0.5 h-px bg-[#7a1818]" />}
                </Link>
              );
            })}
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-[#7a1818] hover:bg-[#5a1010] text-white px-5 py-2.5 text-xs uppercase tracking-[0.2em] font-semibold transition-all hover:gap-3 shadow-sm shadow-[#7a1818]/30"
            >
              <LogIn size={14} /> Entrar no Sistema
            </Link>
          </nav>

          <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-[#7a1818]" aria-label="Menu">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-[#7a1818]/10 bg-[#fbf8f4]">
            <div className="px-6 py-4 flex flex-col gap-3">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-sm uppercase tracking-[0.18em] text-[#1a0808]/80">
                  {n.label}
                </Link>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-2 bg-[#7a1818] text-white px-5 py-3 text-xs uppercase tracking-[0.2em] font-semibold"
              >
                <LogIn size={14} /> Entrar no Sistema
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#3a0a0a] to-[#1a0303] text-[#f5ece0] mt-24">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <img src={s?.logo_url || disarahLogoWhite} alt={s?.brand_name || 'Disarah Interiores'} className="h-14 mb-4 object-contain" />
            <p className="text-[#f5ece0]/70 text-sm leading-relaxed max-w-md">
              {s?.tagline || 'Móveis que transformam ambientes. Curadoria refinada para a sua casa.'}
            </p>
            <div className="flex gap-3 mt-6">
              {s?.show_instagram && s?.instagram_url && (
                <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="h-10 w-10 grid place-items-center rounded-full border border-[#f5ece0]/20 hover:bg-[#7a1818] hover:border-[#7a1818] transition-colors" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
              )}
              {s?.show_facebook && s?.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="h-10 w-10 grid place-items-center rounded-full border border-[#f5ece0]/20 hover:bg-[#7a1818] hover:border-[#7a1818] transition-colors" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-[#d4a574] mb-4 font-semibold">Contato</h4>
            <ul className="space-y-3 text-sm text-[#f5ece0]/80">
              {s?.address && (<li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[#d4a574]" /><span>{s.address}</span></li>)}
              {s?.phone && (<li className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-[#d4a574]" /><span>{s.phone}</span></li>)}
              {s?.email && (<li className="flex gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-[#d4a574]" /><a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a></li>)}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-[#d4a574] mb-4 font-semibold">Atendimento</h4>
            <ul className="space-y-2 text-sm text-[#f5ece0]/80">
              {s?.hours_weekdays && <li className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-[#d4a574]" /><span>{s.hours_weekdays}</span></li>}
              {s?.hours_saturday && <li className="pl-6">{s.hours_saturday}</li>}
              {s?.hours_sunday && <li className="pl-6">{s.hours_sunday}</li>}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#f5ece0]/10">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#f5ece0]/60">
            <p>© {new Date().getFullYear()} {s?.brand_name || 'Disarah Interiores'}. Todos os direitos reservados.</p>
            <p>
              Desenvolvido por{' '}
              <a href="https://typoserp.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#d4722e] hover:text-[#f0d78c] transition-colors">
                Typos! ERP
              </a>
            </p>
          </div>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
