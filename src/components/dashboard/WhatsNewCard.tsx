import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronLeft, ChevronRight, ArrowRight, Zap, Calculator, Code2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TyposLogo } from '@/components/brand/TyposLogo';
import {
  ShopifyLogo, WooCommerceLogo, ZapierLogo, N8nLogo, MakeLogo, PowerBILogo, NuvemshopLogo, TrayLogo,
} from '@/components/connectors/ConnectorLogos';
import amazonLogo from '@/assets/logos/amazon-official.png';
import magaluLogo from '@/assets/logos/magalu-official.png';
import melhorEnvioLogo from '@/assets/logos/melhor-envio-official.png';
import uberDirectLogo from '@/assets/logos/uber-direct-official.png';
import { cn } from '@/lib/utils';

interface NewsItem {
  title: string;
  description: string;
  logoNode: React.ReactNode;
  route: string;
  tag: string;
  accent: string;
}

const ImgLogo = ({ src, alt }: { src: string; alt: string }) => (
  <div className="h-8 w-8 rounded-md bg-white border border-border flex items-center justify-center overflow-hidden">
    <img src={src} alt={alt} className="h-7 w-7 object-contain" />
  </div>
);

const NEWS: NewsItem[] = [
  {
    title: 'Plugin oficial WooCommerce',
    description: 'Plugin .zip pronto para WordPress: instale, cole a API Key e os webhooks são criados automaticamente. Estoque, pedidos e status sincronizados nos dois sentidos, com bloqueio definitivo de venda sem estoque.',
    logoNode: <WooCommerceLogo className="h-7 w-7" style={{ color: '#7f54b3' }} />,
    route: '/app/api-connectors',
    tag: 'Novo conector',
    accent: 'from-purple-500/20 via-fuchsia-500/10 to-transparent',
  },
  {
    title: 'Conector Shopify',
    description: 'Sincronize catálogo, estoque e pedidos do Typos! com sua loja Shopify usando API Key dedicada e webhooks em tempo real.',
    logoNode: <ShopifyLogo className="h-7 w-7" style={{ color: '#5e8e3e' }} />,
    route: '/app/api-connectors',
    tag: 'Novo conector',
    accent: 'from-emerald-500/20 via-green-500/10 to-transparent',
  },
  {
    title: 'Nuvemshop / Tiendanube',
    description: 'Conecte a maior plataforma de e-commerce da América Latina e mantenha produtos, estoque e pedidos unificados no ERP.',
    logoNode: <NuvemshopLogo className="h-7 w-7" style={{ color: '#01b6dd' }} />,
    route: '/app/api-connectors',
    tag: 'Novo conector',
    accent: 'from-cyan-500/20 via-sky-500/10 to-transparent',
  },
  {
    title: 'Tray Commerce',
    description: 'Integração completa com Tray: produtos, estoque e pedidos sincronizados e webhooks de eventos de venda.',
    logoNode: <TrayLogo className="h-7 w-7" style={{ color: '#0095da' }} />,
    route: '/app/api-connectors',
    tag: 'Novo conector',
    accent: 'from-sky-500/20 via-blue-500/10 to-transparent',
  },
  {
    title: 'Automações com Zapier',
    description: 'Conecte o Typos! a mais de 6.000 apps (Sheets, Gmail, Slack e muito mais) com automações sem código baseadas em eventos do ERP.',
    logoNode: <ZapierLogo className="h-7 w-7" style={{ color: '#ff4a00' }} />,
    route: '/app/api-connectors',
    tag: 'Automação',
    accent: 'from-orange-500/20 via-amber-500/10 to-transparent',
  },
  {
    title: 'n8n — automações open-source',
    description: 'Crie workflows complexos em n8n consumindo a API Typos! com webhooks autenticados para todos os eventos do ERP.',
    logoNode: <N8nLogo className="h-7 w-7" style={{ color: '#ea4b71' }} />,
    route: '/app/api-connectors',
    tag: 'Automação',
    accent: 'from-pink-500/20 via-rose-500/10 to-transparent',
  },
  {
    title: 'Make (Integromat)',
    description: 'Construtor visual de cenários conectando o Typos! a qualquer SaaS via webhooks e HTTP autenticado.',
    logoNode: <MakeLogo className="h-7 w-7" style={{ color: '#6d00cc' }} />,
    route: '/app/api-connectors',
    tag: 'Automação',
    accent: 'from-violet-500/20 via-purple-500/10 to-transparent',
  },
  {
    title: 'Power BI / Looker',
    description: 'Conecte sua ferramenta de BI à API REST do Typos! e construa dashboards de vendas em tempo real.',
    logoNode: <PowerBILogo className="h-7 w-7" style={{ color: '#f2c811' }} />,
    route: '/app/api-connectors',
    tag: 'BI',
    accent: 'from-yellow-500/20 via-amber-500/10 to-transparent',
  },
  {
    title: 'Sistemas Contábeis',
    description: 'Exporte vendas e clientes para Domínio, Alterdata, Contabilizei e similares por webhook estruturado.',
    logoNode: <div className="h-8 w-8 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center"><Calculator className="h-5 w-5 text-emerald-700" /></div>,
    route: '/app/api-connectors',
    tag: 'Contabilidade',
    accent: 'from-emerald-500/20 via-teal-500/10 to-transparent',
  },
  {
    title: 'API + Aplicativo personalizado',
    description: 'Construa sua própria integração em qualquer linguagem usando a API REST e webhooks com assinatura HMAC.',
    logoNode: <div className="h-8 w-8 rounded-md bg-muted border border-border flex items-center justify-center"><Code2 className="h-5 w-5 text-foreground" /></div>,
    route: '/app/api-connectors',
    tag: 'Desenvolvedor',
    accent: 'from-slate-500/20 via-zinc-500/10 to-transparent',
  },
  {
    title: 'Amazon Marketplace',
    description: 'Publique seus produtos no maior marketplace do mundo com sincronização automática de estoque e pedidos.',
    logoNode: <ImgLogo src={amazonLogo} alt="Amazon" />,
    route: '/app/integrations/amazon',
    tag: 'Marketplace',
    accent: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  },
  {
    title: 'Magazine Luiza',
    description: 'Conecte sua loja ao Magalu Marketplace e venda para milhões de clientes com gestão unificada.',
    logoNode: <ImgLogo src={magaluLogo} alt="Magalu" />,
    route: '/app/integrations/magalu',
    tag: 'Marketplace',
    accent: 'from-blue-500/20 via-sky-500/10 to-transparent',
  },
  {
    title: 'Melhor Envio',
    description: 'Cotação multi-transportadora em tempo real: Correios, Jadlog, Loggi, Azul e muito mais.',
    logoNode: <ImgLogo src={melhorEnvioLogo} alt="Melhor Envio" />,
    route: '/app/integrations/melhor-envio',
    tag: 'Logística',
    accent: 'from-indigo-500/20 via-blue-500/10 to-transparent',
  },
  {
    title: 'Uber Direct',
    description: 'Entrega on-demand local para seus clientes. Compre de manhã, receba à tarde com rastreamento ao vivo.',
    logoNode: <ImgLogo src={uberDirectLogo} alt="Uber Direct" />,
    route: '/app/integrations/uber-direct',
    tag: 'Logística',
    accent: 'from-neutral-500/20 via-stone-500/10 to-transparent',
  },
];

const STORAGE_KEY = 'typos:whats-new:dismissed-v3';

export default function WhatsNewCard() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  useEffect(() => {
    if (paused || dismissed) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % NEWS.length), 5000);
    return () => clearInterval(t);
  }, [paused, dismissed]);

  if (dismissed) return null;

  const item = NEWS[index];

  const go = (delta: number) => setIndex((i) => (i + delta + NEWS.length) % NEWS.length);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg shadow-primary/5 animate-fade-in"
    >
      {/* Decorative glow */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 transition-all duration-700', item.accent)} />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

      {/* Close */}
      <button
        onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }}
        className="absolute top-3 right-3 z-20 text-xs text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-background/50"
        aria-label="Dispensar novidades"
      >
        Dispensar
      </button>

      <div className="relative p-5 sm:p-7 grid gap-6 md:grid-cols-[auto,1fr,auto] md:items-center">
        {/* Logo block */}
        <div className="flex flex-col items-center md:items-start gap-2 md:border-r md:border-border/40 md:pr-6">
          <TyposLogo size="md" showCredit />
          <div className="flex items-center gap-1.5 mt-1">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              Novidades
            </span>
          </div>
        </div>

        {/* Slide content */}
        <button
          onClick={() => navigate(item.route)}
          className="text-left group min-w-0"
        >
          <div key={index} className="animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background shadow-sm group-hover:scale-110 transition-transform overflow-hidden">
                {item.logoNode}
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                {item.tag}
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary/80 hidden sm:inline-flex">
                <Zap className="h-3 w-3 mr-1" /> Novo
              </Badge>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Acessar módulo <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </button>

        {/* Controls */}
        <div className="flex md:flex-col items-center gap-2 justify-self-end">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => go(-1)}
            className="h-8 w-8 rounded-full hover:bg-primary/10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {String(index + 1).padStart(2, '0')}/{String(NEWS.length).padStart(2, '0')}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => go(1)}
            className="h-8 w-8 rounded-full hover:bg-primary/10"
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dots */}
      <div className="relative flex items-center justify-center gap-1.5 pb-4">
        {NEWS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === index ? 'w-6 bg-primary' : 'w-1.5 bg-primary/25 hover:bg-primary/50'
            )}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/10">
        <div
          key={`${index}-${paused}`}
          className={cn('h-full bg-gradient-to-r from-primary via-primary/80 to-primary', !paused && 'animate-news-progress')}
          style={{ width: paused ? '100%' : '0%' }}
        />
      </div>
    </div>
  );
}
