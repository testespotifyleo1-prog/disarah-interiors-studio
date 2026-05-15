import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { WhatsAppLogo, ShopeeLogo, MercadoPagoLogo, MercadoLivreLogo, InstagramLogo, FacebookLogo, LinkedInLogo } from '@/components/brand/BrandLogos';
import {
  ShopifyLogo, WooCommerceLogo, ZapierLogo, N8nLogo, MakeLogo, PowerBILogo, NuvemshopLogo, TrayLogo,
} from '@/components/connectors/ConnectorLogos';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import amazonLogo from '@/assets/logos/amazon-official.png';
import magaluLogo from '@/assets/logos/magalu-official.png';
import melhorEnvioLogo from '@/assets/logos/melhor-envio-official.png';
import uberDirectLogo from '@/assets/logos/uber-direct-official.png';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, Package, BarChart3, Users, Truck, Receipt,
  Shield, Tags, Calculator, Bot, ArrowRight,
  CheckCircle2, Star, Menu, X, Globe, FileText, Zap, Clock,
  Headphones, Store, Mic, Image as ImageIcon, Brain, Sparkles, DollarSign,
  Sofa, PartyPopper, Heart, ShieldCheck, MessageCircle, TrendingUp,
} from 'lucide-react';

import dashboardImg from '@/assets/landing/dashboard-real.png';
import dashboardIaImg from '@/assets/landing/dashboard-ia.jpg';
import heroBgImg from '@/assets/landing/hero-bg.jpg';
import pdvImg from '@/assets/landing/pdv-real.png';
import aiSimBefore from '@/assets/landing/ai-sim-before.jpg';
import aiSimAfter from '@/assets/landing/ai-sim-after.jpg';

const WHATSAPP_NUMBER = '5531995243550';

/* ——— Intersection fade-in hook ——— */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, className: `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}` };
}

/* ——— Data ——— */
type NavItem = {
  label: string;
  href?: string;
  submenu?: { label: string; href: string; desc?: string; highlight?: boolean }[];
};

const navLinks: NavItem[] = [
  {
    label: 'Funcionalidades',
    href: '#recursos',
    submenu: [
      { label: 'PDV Completo & PDV Rápido', href: '#recursos', desc: 'Vendas em segundos com código de barras' },
      { label: 'Estoque Multi-Loja', href: '#recursos', desc: 'Reposição, validades e transferências' },
      { label: 'Emissão Fiscal NFC-e / NF-e', href: '#recursos', desc: 'Cupom e nota integrados ao PDV' },
      { label: 'Chatbot WhatsApp com IA', href: '#chatbot', desc: 'Atendente virtual 24h — diferencial' },
      { label: 'Loja Virtual & E-commerce', href: '#recursos', desc: 'Vitrine integrada ao estoque' },
      { label: 'Crediário & Comissões', href: '#recursos', desc: 'Parcelas, faixas e limites por cliente' },
      { label: 'Entregas, Rotas & Montagens', href: '#recursos', desc: 'Logística completa' },
      { label: 'Dashboard & Relatórios', href: '#recursos', desc: 'Lucro, fluxo de caixa, ticket médio' },
      { label: 'Ver todas as funcionalidades →', href: '#recursos', highlight: true },
    ],
  },
  {
    label: 'Segmentos',
    href: '#segmentos',
    submenu: [
      { label: 'Loja de Móveis & Colchões', href: '#segmentos', desc: 'Pedidos, entregas e montagens' },
      { label: 'Loja de Festas & Decoração', href: '#segmentos', desc: 'Balões, descartáveis e temáticos' },
      { label: 'Distribuidora & Atacado', href: '#segmentos', desc: 'Alto volume e preços por faixa' },
      { label: 'Mercearia & Hortifruti', href: '#segmentos', desc: 'Validades e PDV rápido' },
      { label: 'Pet Shop & Farmácia', href: '#segmentos', desc: 'Cliente fiel com histórico' },
      { label: 'Materiais de Construção', href: '#segmentos', desc: 'Multi-loja e orçamentos' },
      { label: 'Loja de Roupas & Calçados', href: '#segmentos', desc: 'Variações de cor e tamanho' },
      { label: 'Ver todos os segmentos →', href: '#segmentos', highlight: true },
    ],
  },
  {
    label: 'Integrações',
    href: '#integracoes',
    submenu: [
      { label: 'WhatsApp + IA', href: '#integracoes', desc: 'Chatbot e atendimento automático' },
      { label: 'Mercado Livre', href: '#integracoes', desc: 'Produtos, estoque e pedidos sincronizados' },
      { label: 'Shopee', href: '#integracoes', desc: 'Publique e venda direto pelo ERP' },
      { label: 'Mercado Pago', href: '#integracoes', desc: 'Pix, cartão e boleto integrados' },
      { label: 'Amazon', href: '#integracoes', desc: 'Venda no marketplace global' },
      { label: 'Magalu', href: '#integracoes', desc: 'Magazine Luiza Marketplace' },
      { label: 'Melhor Envio', href: '#integracoes', desc: 'Frete multi-transportadora' },
      { label: 'Uber Direct', href: '#integracoes', desc: 'Entrega same-day local' },
      { label: 'Ver todas as integrações →', href: '#integracoes', highlight: true },
    ],
  },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Planos', href: '#precos' },
  { label: 'API', href: '/docs/api' },
];

const mainFeatures = [
  { icon: ShoppingCart, title: 'PDV Completo', desc: 'Ponto de venda rápido com código de barras, descontos, múltiplos pagamentos e cupom fiscal.' },
  { icon: Package, title: 'Estoque Inteligente', desc: 'Multi-loja com alertas de reposição, validades, transferências e sugestões automáticas.' },
  { icon: BarChart3, title: 'Dashboard & Relatórios', desc: 'Gráficos de vendas, lucratividade, fluxo de caixa e relatórios exportáveis.' },
  { icon: Receipt, title: 'NFC-e / NF-e', desc: 'Emissão fiscal automática integrada. NFC-e no PDV e NF-e para vendas maiores.' },
  { icon: Users, title: 'Multi-Lojas & Equipes', desc: 'Gerencie várias lojas, vendedores e permissões em uma única conta.' },
  { icon: Bot, title: 'Chatbot WhatsApp IA', desc: 'Atendimento automático via WhatsApp com IA. Responde clientes e gera vendas 24/7.' },
  { icon: Truck, title: 'Entregas & Logística', desc: 'Motoristas, rotas, agendamento e acompanhamento em tempo real.' },
  { icon: Calculator, title: 'Comissões & Crediário', desc: 'Comissões por faixas, crediário com parcelas e limites por cliente.' },
  { icon: Shield, title: 'Segurança com PIN', desc: 'Operações sensíveis protegidas por PIN do proprietário.' },
  { icon: Tags, title: 'Etiquetas & Códigos', desc: 'Geração automática de etiquetas com código de barras para impressão.' },
  { icon: Globe, title: 'Loja Virtual', desc: 'Vitrine online integrada ao estoque. Pedidos entram automaticamente.' },
  { icon: FileText, title: 'Orçamentos & Cotações', desc: 'Orçamentos profissionais em PDF, envio por WhatsApp e conversão em venda.' },
];

const integrations = [
  { name: 'WhatsApp', desc: 'Chatbot com IA para atendimento automático e notificações.', logo: <WhatsAppLogo className="h-10 w-10" />, color: '#25D366' },
  { name: 'Mercado Livre', desc: 'Sincronize produtos, estoque e pedidos automaticamente.', logo: <MercadoLivreLogo className="h-10 w-10" />, color: '#FFE600' },
  { name: 'Shopee', desc: 'Publique produtos e controle estoque integrado.', logo: <ShopeeLogo className="h-10 w-10" />, color: '#EE4D2D' },
  { name: 'Mercado Pago', desc: 'Pix, cartão e boleto com conciliação automática.', logo: <MercadoPagoLogo className="h-10 w-10" />, color: '#00B1EA' },
  { name: 'Amazon', desc: 'Venda no maior marketplace do mundo com SP-API oficial.', logo: <img src={amazonLogo} alt="Amazon" className="h-10 w-10 object-contain" />, color: '#FF9900' },
  { name: 'Magazine Luiza', desc: 'Publique e venda no Magalu Marketplace direto do ERP.', logo: <img src={magaluLogo} alt="Magalu" className="h-10 w-10 object-contain" />, color: '#0086FF' },
  { name: 'Melhor Envio', desc: 'Cotação multi-transportadora: Correios, Jadlog, Loggi e mais.', logo: <img src={melhorEnvioLogo} alt="Melhor Envio" className="h-10 w-10 object-contain" />, color: '#0D6EFD' },
  { name: 'Uber Direct', desc: 'Entrega on-demand local same-day com motorista Uber.', logo: <img src={uberDirectLogo} alt="Uber Direct" className="h-10 w-10 object-contain" />, color: '#000000' },
];

const testimonials = [
  { name: 'Marlene Angelo', role: 'JP Móveis — Vespasiano/MG', text: 'Uso o Typos! e não troco por nada. O controle de estoque e o PDV agilizaram demais o dia a dia da loja. A equipe de suporte é excepcional, sempre pronta pra ajudar. Recomendo de olhos fechados!', rating: 5, initials: 'MA' },
  { name: 'Paulo Miranda', role: 'Miranda Móveis — Vespasiano/MG', text: 'Antes do Typos! eu perdia horas com planilhas e controles manuais. Hoje minha gestão é outra: os relatórios financeiros e o controle de entregas me deram uma visão que eu nunca tive do meu negócio.', rating: 5, initials: 'PM' },
  { name: 'Fábia Gil', role: 'Disarah Interiores — Sagrada Família, BH/MG', text: 'O Typos! trouxe profissionalismo para a Disarah. Orçamentos em PDF, emissão fiscal integrada e o crediário organizado fizeram toda a diferença. Uma parceria que só tem evoluído junto com a loja.', rating: 5, initials: 'FG' },
];

const segmentos = [
  {
    tab: 'Comércio',
    title: 'Sistema ERP para comércio',
    bullets: [
      'PDV completo com código de barras, descontos e múltiplos pagamentos',
      'Controle de estoque multi-loja com alertas de reposição',
      'Emissão fiscal automática (NFC-e e NF-e)',
      'Gestão financeira completa com fluxo de caixa e contas a pagar/receber',
    ],
    niches: ['Loja de Roupas', 'Materiais de Construção', 'Autopeças', 'Papelaria', 'Ótica', 'Bazar'],
  },
  {
    tab: 'Festas & Decoração',
    title: 'Sistema ERP para lojas de festas',
    bullets: [
      'Catálogo completo de balões, descartáveis e artigos temáticos',
      'Controle de validade e lotes para produtos perecíveis',
      'Orçamentos profissionais em PDF e envio por WhatsApp',
      'Chatbot IA que consulta estoque e gera vendas automaticamente',
    ],
    niches: ['Loja de Festas', 'Decoração de Eventos', 'Artigos para Festas', 'Doces e Confeitaria', 'Balões'],
  },
  {
    tab: 'Móveis & Casa',
    title: 'Sistema ERP para lojas de móveis',
    bullets: [
      'Gestão completa de pedidos, entregas e montagens',
      'Controle de motoristas, agendamentos e rotas',
      'Comissões por vendedor com faixas configuráveis',
      'Pré-venda e orçamentos com conversão em venda',
    ],
    niches: ['Loja de Móveis', 'Colchões', 'Eletrodomésticos', 'Decoração', 'Cozinhas Planejadas'],
  },
  {
    tab: 'Alimentação',
    title: 'Sistema ERP para alimentação',
    bullets: [
      'Controle rigoroso de validades e lotes',
      'PDV rápido ideal para alto fluxo de atendimento',
      'Gestão de fornecedores e pedidos de compra',
      'Etiquetas com código de barras para pesagem e venda',
    ],
    niches: ['Distribuidora', 'Mercearia', 'Hortifruti', 'Açougue', 'Empório', 'Atacado'],
  },
  {
    tab: 'Pet & Saúde',
    title: 'Sistema ERP para pet shops e saúde',
    bullets: [
      'Cadastro completo de clientes com histórico de compras',
      'Crediário com limites e parcelas por cliente',
      'Transferências entre lojas com controle de estoque',
      'Relatórios de vendas, lucratividade e ticket médio',
    ],
    niches: ['Pet Shop', 'Farmácia', 'Perfumaria', 'Produtos Naturais', 'Sex Shop'],
  },
  {
    tab: 'Varejo em Geral',
    title: 'Sistema ERP para varejo',
    bullets: [
      'Adapta-se a qualquer tipo de comércio varejista',
      'Multi-loja com visão centralizada de vendas e estoque',
      'Loja virtual integrada ao estoque com pedidos automáticos',
      'Importação em massa de produtos via planilha',
    ],
    niches: ['Livraria', 'Loja de Brinquedos', 'Loja de Informática', 'Loja de Calçados', 'Conveniência'],
  },
];

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ instagram: '', facebook: '', linkedin: '' });
  const [whatsappBubbleDismissed, setWhatsappBubbleDismissed] = useState(false);
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Tenho interesse no Typos! ERP. Gostaria de saber mais.')}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    supabase.from('site_settings').select('key, value').in('key', ['social_instagram', 'social_facebook', 'social_linkedin']).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setSocialLinks({ instagram: map.social_instagram || '', facebook: map.social_facebook || '', linkedin: map.social_linkedin || '' });
      }
    });
  }, []);

  const fade1 = useFadeIn();
  const fade2 = useFadeIn();
  const fade3 = useFadeIn();
  const fade4 = useFadeIn();
  const fade5 = useFadeIn();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* ===== NAVBAR ===== */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md shadow-sm' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between h-20 ${!scrolled ? 'border-b border-white/[0.06]' : ''}`}>
            <Link to="/" className="shrink-0">
              <TyposLogo size="sm" showCredit />
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(l => (
                <div key={l.label} className="relative group">
                  <a
                    href={l.href || '#'}
                    className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${scrolled ? 'text-foreground/70 hover:text-foreground hover:bg-muted' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  >
                    {l.label}
                    {l.submenu && (
                      <svg className="h-3 w-3 opacity-60 group-hover:rotate-180 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5l4.5 4.5 4.5-4.5z"/></svg>
                    )}
                  </a>
                  {l.submenu && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-[340px]">
                      <div className="rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
                        <div className="p-2">
                          {l.submenu.map(item => (
                            <a
                              key={item.label}
                              href={item.href}
                              className={`block px-3 py-2.5 rounded-lg transition-colors ${item.highlight ? 'mt-1 border-t border-border pt-3 text-primary font-bold hover:bg-primary/10' : 'hover:bg-muted'}`}
                            >
                              <div className={`text-sm ${item.highlight ? 'text-primary' : 'font-semibold text-foreground'}`}>{item.label}</div>
                              {item.desc && !item.highlight && (
                                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</div>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" className={`rounded-full px-6 text-sm font-semibold ${!scrolled ? 'text-white/80 hover:text-white hover:bg-white/10' : ''}`}>
                  Entrar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
              <Link to="/onboarding">
                <Button className="rounded-full px-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
                  Teste grátis
                </Button>
              </Link>
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className={`h-5 w-5 ${scrolled ? '' : 'text-white'}`} /> : <Menu className={`h-5 w-5 ${scrolled ? '' : 'text-white'}`} />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-background border-t border-border px-4 pb-4 pt-2 space-y-1 shadow-xl max-h-[80vh] overflow-y-auto">
            {navLinks.map(l => (
              <div key={l.label} className="border-b border-border/50 last:border-0 py-1">
                <a
                  href={l.href || '#'}
                  onClick={() => setMobileMenu(false)}
                  className="block py-2.5 px-3 text-sm font-bold text-foreground hover:bg-muted rounded-lg"
                >
                  {l.label}
                </a>
                {l.submenu && (
                  <div className="pl-3 pb-2 space-y-0.5">
                    {l.submenu.map(item => (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenu(false)}
                        className={`block py-2 px-3 text-xs rounded-lg ${item.highlight ? 'text-primary font-bold' : 'text-foreground/70 hover:text-foreground hover:bg-muted'}`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-3">
              <Link to="/login" className="flex-1"><Button variant="outline" className="w-full rounded-full" size="sm">Entrar</Button></Link>
              <Link to="/onboarding" className="flex-1"><Button className="w-full rounded-full" size="sm">Teste grátis</Button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBgImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-primary/[0.08] rounded-full blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-10 sm:pb-14">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="max-w-xl">

              <h1 className="text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] font-black text-white leading-[1.05] tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
                O <span className="bg-gradient-to-r from-primary via-[#D4722E] to-primary bg-clip-text text-transparent">ERP completo</span> com IA para sua loja vender mais.
              </h1>

              <p className="mt-4 text-sm sm:text-base text-white/75 leading-relaxed max-w-lg">
                PDV, estoque, emissão fiscal, <strong className="text-[#25D366]">chatbot WhatsApp com IA</strong> e o exclusivo <strong className="text-primary">Simulador de Ambiente com IA</strong> — tudo em um só sistema.
              </p>

              {/* 4 pilares principais */}
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {[
                  { icon: ShoppingCart, title: 'ERP Completo', desc: 'PDV, estoque, financeiro', color: 'text-primary' },
                  { icon: Receipt, title: 'Fiscal', desc: 'NFC-e e NF-e integradas', color: 'text-primary' },
                  { icon: Bot, title: 'Chatbot + IA', desc: 'Atende WhatsApp 24/7', color: 'text-[#25D366]' },
                  { icon: Sparkles, title: 'Simulador IA', desc: 'Produto no ambiente', color: 'text-primary', highlight: true },
                ].map(p => (
                  <div
                    key={p.title}
                    className={`flex items-start gap-2.5 rounded-xl border bg-white/[0.04] backdrop-blur-sm px-3 py-2.5 ${p.highlight ? 'border-primary/40 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)]' : 'border-white/[0.08]'}`}
                  >
                    <p.icon className={`h-4 w-4 ${p.color} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white leading-tight">{p.title}</p>
                      <p className="text-[11px] text-white/55 leading-tight mt-0.5">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 mt-6">
                <Link to="/onboarding" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-full text-sm sm:text-base gap-2 h-12 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.8)] hover:-translate-y-0.5 transition-all duration-300 group">
                    Teste grátis por 7 dias <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#ai-simulacao" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full text-sm sm:text-base h-12 px-6 font-semibold border-2 border-white/30 text-white hover:text-white hover:bg-white/10 hover:border-white/50 bg-white/5 backdrop-blur-sm transition-all duration-300">
                    Ver Simulador IA
                  </Button>
                </a>
              </div>
            </div>

            {/* Right: laptop + tablet com integrações flutuantes */}
            <div className="relative block h-[440px] sm:h-[520px] lg:h-[600px] mt-8 lg:mt-0 px-6 sm:px-10">
              {/* Glow ambiental atrás */}
              <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />

              {/* Pontinhos decorativos verdes */}
              {[
                { top: '4%', left: '14%', size: 8 },
                { top: '18%', left: '2%', size: 10 },
                { top: '90%', left: '38%', size: 8 },
                { top: '6%', right: '8%', size: 10 },
                { top: '92%', right: '14%', size: 8 },
              ].map((d, i) => (
                <span
                  key={i}
                  className="absolute rounded-full bg-[#25D366]/70 shadow-[0_0_12px_rgba(37,211,102,0.6)] animate-float-medium"
                  style={{ ...d, width: d.size, height: d.size, animationDelay: `${i * 0.4}s` } as any}
                />
              ))}

              {/* LAPTOP */}
              <div className="absolute top-[4%] left-1/2 -translate-x-1/2 w-[78%] sm:w-[76%] z-10">
                {/* Tela */}
                <div className="relative rounded-t-2xl bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] p-2.5 pb-3 shadow-2xl border border-white/10">
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                  </div>
                  <div className="rounded-md overflow-hidden bg-black aspect-[16/10]">
                    <img src={dashboardIaImg} alt="Painel do Typos! ERP" className="w-full h-full object-cover object-top" loading="eager" />
                  </div>
                </div>
                {/* Base do laptop */}
                <div className="relative h-3 bg-gradient-to-b from-[#c8c8cc] to-[#8a8a90] rounded-b-xl mx-[-3%] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#5a5a60] rounded-b-md" />
                </div>
                <div className="h-1 bg-black/40 mx-[6%] rounded-b-full blur-[1px]" />
              </div>

              {/* TABLET (sobreposto, canto inferior esquerdo) */}
              <div className="absolute bottom-[4%] left-[4%] sm:left-[2%] w-[36%] sm:w-[34%] z-20">
                <div className="relative rounded-[18px] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] p-1.5 shadow-2xl border border-white/10 rotate-[-5deg]">
                  <div className="absolute top-1/2 -translate-y-1/2 left-1 h-1.5 w-1.5 rounded-full bg-white/30" />
                  <div className="rounded-[12px] overflow-hidden bg-white aspect-[4/3] ml-2">
                    <img src={pdvImg} alt="PDV do Typos! ERP" className="w-full h-full object-cover object-left-top" loading="lazy" />
                  </div>
                </div>
              </div>

              {/* BOLINHAS DE INTEGRAÇÕES — orbitando pelas bordas, sem cobrir o tablet */}
              {[
                // Topo
                { node: <MercadoLivreLogo className="h-6 w-6 sm:h-7 sm:w-7" />, bg: 'bg-[#FFE600]', pos: 'top-[-2%] left-[18%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '0s' },
                { node: <img src={amazonLogo} alt="Amazon" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />, bg: 'bg-white', pos: 'top-[-3%] right-[14%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '0.3s' },
                // Lateral esquerda (acima do tablet)
                { node: <ShopeeLogo className="h-6 w-6 sm:h-7 sm:w-7" />, bg: 'bg-white', pos: 'top-[18%] left-[-3%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '0.6s' },
                { node: <img src={magaluLogo} alt="Magalu" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />, bg: 'bg-white', pos: 'top-[36%] left-[-5%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '0.9s' },
                // Lateral direita
                { node: <ShopifyLogo className="h-7 w-7 sm:h-8 sm:w-8" />, bg: 'bg-[#95BF47]', pos: 'top-[20%] right-[-4%]', size: 'h-14 w-14 sm:h-16 sm:w-16', delay: '0.4s' },
                { node: <N8nLogo className="h-6 w-6 sm:h-7 sm:w-7" />, bg: 'bg-[#EA4B71]', pos: 'top-[42%] right-[-5%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '0.7s' },
                { node: <WooCommerceLogo className="h-6 w-6 sm:h-7 sm:w-7" />, bg: 'bg-[#7F54B3]', pos: 'top-[62%] right-[-3%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '1s' },
                // Inferior direita (longe do tablet)
                { node: <MercadoPagoLogo className="h-6 w-6 sm:h-7 sm:w-7" />, bg: 'bg-white', pos: 'bottom-[6%] right-[10%]', size: 'h-12 w-12 sm:h-14 sm:w-14', delay: '1.2s' },
                { node: <img src={melhorEnvioLogo} alt="Melhor Envio" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />, bg: 'bg-white', pos: 'bottom-[22%] right-[22%]', size: 'h-11 w-11 sm:h-12 sm:w-12', delay: '0.5s' },
                { node: <img src={uberDirectLogo} alt="Uber Direct" className="h-5 w-5 sm:h-6 sm:w-6 object-contain invert" />, bg: 'bg-black', pos: 'bottom-[-2%] right-[36%]', size: 'h-11 w-11 sm:h-12 sm:w-12', delay: '1.4s' },
              ].map((b, i) => (
                <div
                  key={i}
                  className={`absolute ${b.pos} ${b.size} ${b.bg} rounded-full flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)] ring-1 ring-black/5 animate-float-slow z-30`}
                  style={{ animationDelay: b.delay }}
                >
                  {b.node}
                </div>
              ))}

              {/* Badge "+ integrações" — fixo no topo, sem sobrepor */}
              <div className="absolute top-[-4%] left-1/2 -translate-x-1/2 z-30 animate-float-medium" style={{ animationDelay: '1.5s' }}>
                <div className="rounded-full bg-white/95 backdrop-blur px-3 py-1.5 shadow-lg ring-1 ring-black/10 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold text-gray-800">+ 10 integrações nativas</span>
                </div>
              </div>
            </div>
          </div>


          <div className="h-4" />
        </div>
      </section>

      {/* ===== LOGO BAR — Integrações em destaque ===== */}
      <section className="relative py-20 sm:py-24 overflow-hidden bg-gradient-to-br from-[#0a0f1a] via-[#0f1729] to-[#0a0f1a] text-white border-y border-white/5" ref={fade1.ref}>
        {/* Glow ambient */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-[#25D366]/10 rounded-full blur-[140px] pointer-events-none" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className={`relative mx-auto max-w-6xl px-4 ${fade1.className}`}>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-4 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Integrações nativas</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
              Integra com as <span className="bg-gradient-to-r from-primary via-[#D4722E] to-primary bg-clip-text text-transparent">maiores plataformas</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/60 max-w-2xl mx-auto">
              Tudo conectado em um só lugar. Sincronização automática, sem dor de cabeça.
            </p>
          </div>

          {(() => {
            const items: { name: string; tag: string; logo: React.ReactNode; glow: string }[] = [
              { name: 'WhatsApp', tag: 'Chatbot IA', logo: <WhatsAppLogo className="h-9 w-9" />, glow: 'rgba(37, 211, 102, 0.35)' },
              { name: 'Mercado Livre', tag: 'Marketplace', logo: <MercadoLivreLogo className="h-9 w-9" />, glow: 'rgba(255, 230, 0, 0.35)' },
              { name: 'Shopee', tag: 'Marketplace', logo: <ShopeeLogo className="h-9 w-9" />, glow: 'rgba(238, 77, 45, 0.35)' },
              { name: 'Mercado Pago', tag: 'Pagamentos', logo: <MercadoPagoLogo className="h-9 w-9" />, glow: 'rgba(0, 177, 234, 0.35)' },
              { name: 'Amazon', tag: 'Marketplace', logo: <img src={amazonLogo} alt="Amazon" className="h-9 w-9 object-contain" />, glow: 'rgba(255, 153, 0, 0.35)' },
              { name: 'Magalu', tag: 'Marketplace', logo: <img src={magaluLogo} alt="Magalu" className="h-9 w-9 object-contain" />, glow: 'rgba(0, 134, 255, 0.35)' },
              { name: 'Melhor Envio', tag: 'Logística', logo: <img src={melhorEnvioLogo} alt="Melhor Envio" className="h-9 w-9 object-contain" />, glow: 'rgba(13, 110, 253, 0.35)' },
              { name: 'Uber Direct', tag: 'Entrega', logo: <img src={uberDirectLogo} alt="Uber Direct" className="h-9 w-9 object-contain" />, glow: 'rgba(255, 255, 255, 0.25)' },
              { name: 'WooCommerce', tag: 'E-commerce', logo: <WooCommerceLogo className="h-9 w-9" style={{ color: '#7f54b3' }} />, glow: 'rgba(127, 84, 179, 0.35)' },
              { name: 'Shopify', tag: 'E-commerce', logo: <ShopifyLogo className="h-9 w-9" style={{ color: '#5e8e3e' }} />, glow: 'rgba(94, 142, 62, 0.35)' },
              { name: 'Nuvemshop', tag: 'E-commerce', logo: <NuvemshopLogo className="h-9 w-9" style={{ color: '#01b6dd' }} />, glow: 'rgba(1, 182, 221, 0.35)' },
              { name: 'Tray', tag: 'E-commerce', logo: <TrayLogo className="h-9 w-9" style={{ color: '#0095da' }} />, glow: 'rgba(0, 149, 218, 0.35)' },
              { name: 'Zapier', tag: 'Automação', logo: <ZapierLogo className="h-9 w-9" style={{ color: '#ff4a00' }} />, glow: 'rgba(255, 74, 0, 0.35)' },
              { name: 'n8n', tag: 'Automação', logo: <N8nLogo className="h-9 w-9" style={{ color: '#ea4b71' }} />, glow: 'rgba(234, 75, 113, 0.35)' },
              { name: 'Make', tag: 'Automação', logo: <MakeLogo className="h-9 w-9" style={{ color: '#6d00cc' }} />, glow: 'rgba(109, 0, 204, 0.35)' },
              { name: 'Power BI', tag: 'BI', logo: <PowerBILogo className="h-9 w-9" style={{ color: '#f2c811' }} />, glow: 'rgba(242, 200, 17, 0.35)' },
            ];
            const featured = items.slice(0, 8);
            const Tile = ({ item, i }: { item: typeof items[number]; i: number }) => (
              <div
                key={item.name}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5 text-center transition-all duration-500 hover:-translate-y-2 hover:border-white/25 hover:bg-white/[0.06] cursor-default overflow-hidden conecta-float"
                style={{ animationDelay: `${(i % 4) * 0.2}s` }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at center, ${item.glow} 0%, transparent 70%)` }}
                />
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000" />
                </div>
                <div className="relative flex flex-col items-center gap-2.5">
                  <div className="rounded-xl bg-white/95 p-2.5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 flex items-center justify-center">
                    {item.logo}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">{item.name}</p>
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-white/50 mt-0.5">{item.tag}</p>
                  </div>
                </div>
              </div>
            );
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3 sm:gap-4">
                  {featured.map((item, i) => (
                    <Tile key={item.name} item={item} i={i} />
                  ))}
                </div>

                <div className="mt-6 text-center">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Ver todas as {items.length} integrações
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl bg-[#0f1729] border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Todas as integrações nativas</DialogTitle>
                        <DialogDescription className="text-white/60">
                          Marketplaces, e-commerce, pagamentos, logística, BI e automações — tudo conectado ao Typos! ERP.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 pt-2">
                        {items.map((item, i) => (
                          <Tile key={item.name} item={item} i={i} />
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            );
          })()}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span>Mais integrações sendo lançadas todos os meses</span>
          </div>
        </div>
      </section>

      {/* ===== CHATBOT IA — DIFERENCIAL EXCLUSIVO (destaque máximo) ===== */}
      <section id="chatbot" className="relative py-24 sm:py-32 overflow-hidden bg-gradient-to-b from-[#0a0f1a] via-[#0f1729] to-[#0a0f1a] text-white">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#25D366]/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top headline — centralizado */}
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-5 py-2 mb-6 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-[#25D366] animate-pulse" />
              <span className="text-xs font-bold text-[#25D366] uppercase tracking-[0.2em]">O diferencial que ninguém tem</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
              Sua <span className="text-[#25D366]">funcionária virtual</span> que<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary via-[#25D366] to-primary bg-clip-text text-transparent">atende 24h no WhatsApp.</span>
            </h2>
            <p className="mt-6 text-lg sm:text-xl text-white/70 leading-relaxed max-w-2xl mx-auto">
              Uma <strong className="text-white">IA atendente de verdade</strong> que conversa com seus clientes, <strong className="text-white">entende áudio e imagem</strong>, envia fotos de produtos, fecha pedidos e direciona para sua loja online — <strong className="text-[#25D366]">tudo sozinha, enquanto você dorme.</strong>
            </p>

            {/* ROI Strip */}
            <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-6 max-w-3xl mx-auto">
              {[
                { value: '24/7', label: 'Atendimento sem parar', icon: Clock },
                { value: '−1', label: 'Funcionária a menos no caixa', icon: DollarSign },
                { value: '+', label: 'Vendas fora do horário', icon: TrendingUp },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5">
                  <s.icon className="h-5 w-5 text-[#25D366] mx-auto mb-2" />
                  <div className="text-2xl sm:text-3xl font-black text-white">{s.value}</div>
                  <div className="text-[11px] sm:text-xs text-white/60 mt-1 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main grid: chat mockup + capabilities */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Phone mockup — bigger, with animation */}
            <div className="relative flex items-center justify-center">
              {/* Floating capability badges */}
              <div className="absolute -top-4 -left-2 sm:-left-8 z-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 flex items-center gap-1.5 shadow-xl animate-pulse">
                <Mic className="h-3.5 w-3.5 text-[#25D366]" />
                <span className="text-[11px] font-bold text-white">Entende áudio</span>
              </div>
              <div className="absolute top-1/3 -right-2 sm:-right-8 z-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 flex items-center gap-1.5 shadow-xl">
                <ImageIcon className="h-3.5 w-3.5 text-[#25D366]" />
                <span className="text-[11px] font-bold text-white">Lê imagens</span>
              </div>
              <div className="absolute -bottom-2 left-4 sm:left-0 z-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 flex items-center gap-1.5 shadow-xl">
                <Brain className="h-3.5 w-3.5 text-[#25D366]" />
                <span className="text-[11px] font-bold text-white">Aprende o cliente</span>
              </div>

              <div className="relative w-[300px] sm:w-[340px]">
                {/* Glow */}
                <div className="absolute inset-0 bg-[#25D366]/30 blur-3xl rounded-full" />

                <div className="relative bg-[#0d1418] rounded-[2.5rem] p-3 shadow-[0_30px_80px_-20px_rgba(37,211,102,0.4)] border border-white/10">
                  {/* WhatsApp header */}
                  <div className="bg-[#075E54] rounded-t-[2rem] px-4 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-white/20">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-bold">Assistente Typos!</p>
                      <p className="text-white/60 text-[10px] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse" />
                        online • IA ativa
                      </p>
                    </div>
                  </div>

                  {/* Chat body */}
                  <div className="bg-[#0a1014] space-y-2 py-4 px-3 min-h-[420px]">
                    <div className="bg-[#1f2c33] rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/90 max-w-[88%] shadow">
                      Oi Marina! 👋 Bem-vinda de volta. Tô aqui pra te ajudar 💬
                    </div>

                    {/* Audio msg from customer */}
                    <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%] ml-auto shadow flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                        <Mic className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[3,5,7,4,6,8,5,3,6,4,7,5].map((h,i) => (
                          <span key={i} className="w-0.5 bg-white/70 rounded-full" style={{height: `${h*2}px`}} />
                        ))}
                      </div>
                      <span className="text-[10px] text-white/70">0:08</span>
                    </div>

                    <div className="bg-[#1f2c33] rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/90 max-w-[88%] shadow">
                      Entendi! 🎉 Você quer balões metalizados pra festa de 5 anos. Achei essas opções:
                    </div>

                    {/* Product card sent by AI */}
                    <div className="bg-[#1f2c33] rounded-xl rounded-tl-sm overflow-hidden max-w-[88%] shadow">
                      <div className="h-24 bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center">
                        <PartyPopper className="h-10 w-10 text-white/90" />
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[11px] font-bold text-white">Balão Metalizado nº 5 — Rosa</p>
                        <p className="text-[10px] text-white/60">R$ 12,90 • 23 em estoque</p>
                        <p className="text-[10px] text-[#25D366] mt-1 font-semibold">👉 Ver na loja online</p>
                      </div>
                    </div>

                    <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white max-w-[60%] ml-auto shadow">
                      Quero 10! 😍
                    </div>

                    <div className="bg-[#1f2c33] rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/90 max-w-[88%] shadow">
                      ✅ Pronto! 10 unidades reservadas. Total <strong>R$ 129,00</strong>. Te envio o link de pagamento agora!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: capabilities list */}
            <div className="max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-black leading-tight mb-4">
                Atende como sua melhor funcionária —<br />
                <span className="text-[#25D366]">só que sem salário, sem folga e sem erro.</span>
              </h3>
              <p className="text-white/60 text-base leading-relaxed mb-8">
                Enquanto você foca no que importa, a IA do Typos! faz o <strong className="text-white">primeiro atendimento completo</strong>: identifica o cliente pelo nome, entende o que ele quer (mesmo por áudio ou foto), mostra os produtos, envia link da sua loja virtual e fecha venda.
              </p>

              <div className="space-y-3">
                {[
                  { icon: MessageCircle, title: 'Conversa natural com o cliente', desc: 'Cumprimenta pelo nome, entende contexto, responde com bom humor.' },
                  { icon: Mic, title: 'Interpreta áudio do WhatsApp', desc: 'Cliente manda áudio? A IA escuta, transcreve e responde na hora.' },
                  { icon: ImageIcon, title: 'Entende imagens enviadas', desc: 'Foto de um produto? A IA reconhece e busca igual no seu estoque.' },
                  { icon: Package, title: 'Envia produtos com foto e preço', desc: 'Mostra cards visuais direto no WhatsApp e direciona para o e-commerce.' },
                  { icon: Brain, title: 'Aprende o perfil de cada cliente', desc: 'Memoriza marcas favoritas, estilo de conversa e histórico — atende cada vez melhor.' },
                  { icon: Globe, title: 'Integrada à sua loja online', desc: 'Envia link da vitrine, finaliza pedido e libera você do atendimento manual.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.05] hover:border-[#25D366]/30 transition-all">
                    <div className="h-10 w-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-[#25D366]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-[15px] leading-tight">{item.title}</h4>
                      <p className="text-white/55 text-sm mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-10 rounded-2xl border border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/[0.12] to-transparent p-6">
                <p className="text-sm text-white/80 mb-4 leading-relaxed">
                  💰 <strong className="text-white">Economize com folha de pagamento</strong> e nunca mais perca uma venda fora do horário comercial.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/onboarding" className="flex-1">
                    <Button size="lg" className="w-full rounded-full text-[15px] gap-2 h-13 px-6 font-bold bg-[#25D366] text-white hover:bg-[#1da851] shadow-[0_10px_30px_-10px_rgba(37,211,102,0.6)] group">
                      Quero esse atendente IA <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button size="lg" variant="outline" className="w-full rounded-full text-[15px] h-13 px-6 font-semibold border-white/20 text-white hover:bg-white/10 hover:text-white bg-white/5">
                      Ver demonstração
                    </Button>
                  </a>
                </div>
                <p className="text-[11px] text-white/50 mt-3 text-center">Disponível no plano <strong className="text-[#25D366]">Typos Prime</strong> • 7 dias grátis</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== AI SIMULATION — DIFERENCIAL VISUAL ===== */}
      <section id="ai-simulacao" className="relative py-24 sm:py-32 overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span className="text-xs font-black text-primary tracking-wider uppercase">Exclusivo · Inteligência Artificial</span>
              </div>

              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
                Mostre como o produto vai ficar{' '}
                <span className="bg-gradient-to-r from-primary via-[#D4722E] to-purple-500 bg-clip-text text-transparent">
                  no ambiente do cliente
                </span>{' '}
                — antes da venda.
              </h2>

              <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Nossa <strong className="text-foreground">Simulação Inteligente com IA</strong> gera, em segundos, uma imagem realista do seu produto já posicionado no espaço do cliente. Ele <strong className="text-foreground">tira uma foto do ambiente</strong>, escolhe o produto e a IA faz a mágica acontecer.
              </p>
              <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Resultado: o cliente <strong className="text-foreground">vê, se imagina e compra</strong>. Menos dúvida, menos devolução, mais venda fechada.
              </p>

              <div className="mt-8 grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Sofa, title: 'Lojas de Móveis', desc: 'Sofás, mesas, racks, camas e estofados na sala do cliente.' },
                  { icon: PartyPopper, title: 'Artigos para Festas', desc: 'Decoração, balões, painéis e arcos no salão antes da festa.' },
                  { icon: Heart, title: 'Decoração & Casa', desc: 'Tapetes, luminárias, quadros e objetos no espaço real.' },
                  { icon: Store, title: 'Cozinhas & Planejados', desc: 'Móveis sob medida visualizados no cômodo do cliente.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 hover:border-primary/40 hover:bg-card transition-all">
                    <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/onboarding">
                  <Button size="lg" className="rounded-full text-base h-14 px-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5 transition-all gap-2 group">
                    Quero usar IA na minha loja
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Funciona com qualquer foto · Resultado em segundos</span>
                </div>
              </div>
            </div>

            {/* Right: visual mockup */}
            <div className="relative">
              <div className="relative grid grid-cols-2 gap-4">
                {/* Before */}
                <div className="relative">
                  <div className="absolute -top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                    Antes
                  </div>
                  <div className="aspect-[3/4] rounded-2xl border border-border overflow-hidden shadow-xl bg-muted">
                    <img
                      src={aiSimBefore}
                      alt="Foto da sala vazia do cliente — antes da simulação com IA"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      width={768}
                      height={1024}
                    />
                  </div>
                  <p className="text-[11px] text-center mt-2 text-muted-foreground font-medium">Foto do ambiente do cliente</p>
                </div>
                {/* After */}
                <div className="relative mt-12">
                  <div className="absolute -top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-[#D4722E] text-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-lg">
                    <Sparkles className="h-3 w-3" /> Com IA
                  </div>
                  <div className="aspect-[3/4] rounded-2xl border-2 border-primary/40 overflow-hidden shadow-2xl shadow-primary/20 relative bg-muted">
                    <img
                      src={aiSimAfter}
                      alt="Mesma sala agora com sofá, tapete e luminária posicionados pela IA"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      width={768}
                      height={1024}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-purple-500/10" />
                  </div>
                  <p className="text-[11px] text-center mt-2 text-foreground font-bold">Produto já posicionado no espaço</p>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 rounded-2xl bg-card border border-border shadow-2xl p-4 max-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-[#D4722E] flex items-center justify-center">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-foreground leading-tight">IA Generativa</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Resultado em ~10s</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 rounded-2xl bg-card border border-border shadow-2xl p-4 max-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-green-500/15 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-foreground leading-tight">+ Conversão</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Cliente decidido</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SEGMENTOS ===== */}
      <div id="segmentos"><SegmentosSection /></div>

      {/* ===== FEATURES ===== */}
      <section id="recursos" className="py-20 sm:py-28 bg-background" ref={fade2.ref}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${fade2.className}`}>
          <div className="max-w-xl mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Funcionalidades</span>
            <h2 className="text-3xl sm:text-[2.5rem] font-black text-foreground leading-tight tracking-tight">
              Tudo que seu negócio precisa. Em um só lugar.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            {mainFeatures.map((f) => (
              <div key={f.title} className="bg-background p-7 hover:bg-muted/30 transition-colors duration-300 group">
                <div className="h-10 w-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4 group-hover:bg-primary/[0.12] transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SYSTEM SHOWCASE ===== */}
      <section className="py-20 sm:py-28 bg-[#0f1420] text-white" ref={fade3.ref}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${fade3.className}`}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-lg">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Veja na prática</span>
              <h2 className="text-3xl sm:text-[2.5rem] font-black leading-tight tracking-tight">
                Interface pensada para agilidade.
              </h2>
              <p className="mt-6 text-white/40 text-lg leading-relaxed">
                Controle financeiro, vendas no PDV, estoque e emissão fiscal — tudo com uma experiência moderna e intuitiva.
              </p>

              <div className="mt-10 space-y-6">
                {[
                  { n: '1', title: 'Crie sua conta grátis', desc: 'Cadastro em 30 segundos, sem cartão de crédito.' },
                  { n: '2', title: 'Configure seu negócio', desc: 'Ative os módulos que fazem sentido para você.' },
                  { n: '3', title: 'Tenha controle total', desc: 'Acompanhe vendas, estoque e finanças em tempo real.' },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {step.n}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-[15px]">{step.title}</h4>
                      <p className="text-white/35 text-sm mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/onboarding" className="inline-block mt-10">
                <Button className="rounded-full px-8 h-12 font-bold bg-primary text-primary-foreground hover:bg-primary/90 group gap-2">
                  Experimentar agora <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
                <img src={dashboardImg} alt="Sistema Typos! ERP" className="w-full" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHATBOT WHATSAPP — REMOVIDO DAQUI (movido para o topo, após o Logo Bar) ===== */}

      {/* ===== INTEGRATIONS ===== */}
      <section id="integracoes" className="py-20 sm:py-28 bg-muted/20" ref={fade4.ref}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${fade4.className}`}>
          <div className="max-w-xl mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Integrações</span>
            <h2 className="text-3xl sm:text-[2.5rem] font-black text-foreground leading-tight tracking-tight">
              Conecte seu negócio às maiores plataformas.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.map((ig) => (
              <div key={ig.name} className="bg-background rounded-2xl border border-border p-6 hover:shadow-lg hover:border-border/80 transition-all duration-300 group">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5 border border-border group-hover:scale-105 transition-transform" style={{ backgroundColor: `${ig.color}08` }}>
                  {ig.logo}
                </div>
                <h3 className="text-base font-bold text-foreground mb-1.5">{ig.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{ig.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="depoimentos" className="py-20 sm:py-28 bg-background border-y border-border" ref={fade5.ref}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${fade5.className}`}>
          <div className="max-w-xl mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Clientes Reais</span>
            <h2 className="text-3xl sm:text-[2.5rem] font-black text-foreground leading-tight tracking-tight">
              Quem usa, recomenda.
            </h2>
            <p className="mt-3 text-muted-foreground">Depoimentos reais de lojistas que confiam no Typos! há mais de 11 meses.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl bg-background border border-border p-7 hover:shadow-lg transition-all duration-300">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/75 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-5 border-t border-border">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="precos" className="py-20 sm:py-28 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Planos</span>
            <h2 className="text-3xl sm:text-[2.5rem] font-black text-foreground leading-tight tracking-tight">
              Escolha o plano ideal.
            </h2>
            <p className="mt-4 text-muted-foreground">7 dias grátis em todos os planos. Sem cartão de crédito.</p>
          </div>

          <DynamicPricing />


          <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
            Implantação, customizações e migrações complexas são serviços adicionais, não inclusos nos planos mensais.
          </p>
        </div>
      </section>

      {/* ===== FREE TRIAL BANNER ===== */}
      <section className="py-16 bg-background border-b border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 mb-6">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold text-primary">Teste grátis por 7 dias</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3 tracking-tight">
            Experimente todas as funcionalidades sem compromisso.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Sem cartão de crédito. Configure em 30 segundos e tenha acesso completo ao sistema por 7 dias.
          </p>
          <Link to="/onboarding">
            <Button size="lg" className="rounded-full text-[15px] gap-2 h-13 px-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90 group">
              Criar conta grátis agora <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Sem cartão</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Suporte via WhatsApp</span>
          </div>
        </div>
      </section>

      {/* ===== SUPORTE ===== */}
      <section className="py-20 sm:py-28 bg-[#0f1420] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/[0.08] border border-primary/20 px-4 py-1.5 mb-6">
                <Headphones className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Suporte dedicado</span>
              </div>
              <h2 className="text-3xl sm:text-[2.5rem] font-black leading-tight tracking-tight">
                Nossa equipe te ajuda em toda a integração.
              </h2>
              <p className="mt-6 text-white/40 text-lg leading-relaxed">
                Você não precisa configurar tudo sozinho. Nossa equipe está pronta para ajudar em toda a implantação — do cadastro de produtos à configuração fiscal.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  'Suporte humanizado dentro do próprio sistema',
                  'Ajuda na importação de produtos e estoque',
                  'Configuração fiscal completa (NFC-e / NF-e)',
                  'Treinamento e acompanhamento personalizado',
                  'Migração assistida de outros sistemas',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-white/60">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/onboarding" className="inline-block mt-10">
                <Button className="rounded-full px-8 h-12 font-bold bg-primary text-primary-foreground hover:bg-primary/90 group gap-2">
                  Começar com suporte <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Headphones className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">Equipe Typos!</p>
                      <p className="text-white/35 text-xs">Suporte especializado</p>
                    </div>
                  </div>
                  {[
                    { q: 'Preciso de ajuda pra configurar o fiscal', a: 'Claro! Vamos configurar juntos. Me passa o CNPJ que eu cuido de tudo pra você 😊' },
                    { q: 'Como importo meus produtos?', a: 'Fácil! Me envia sua planilha que fazemos a importação completa. Pode ser Excel ou CSV.' },
                  ].map((msg, i) => (
                    <div key={i} className="space-y-2">
                      <div className="bg-white/[0.06] rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white/70 max-w-[85%] ml-auto">{msg.q}</div>
                      <div className="bg-primary/15 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/80 max-w-[90%]">{msg.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="py-24 bg-background border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-[2.5rem] font-black text-foreground mb-4 tracking-tight">
            Pronto para revolucionar sua gestão?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Junte-se a centenas de empresários que já simplificaram seu negócio. Comece agora com 7 dias grátis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/onboarding">
              <Button size="lg" className="rounded-full text-[15px] gap-2 h-13 px-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90 group">
                Começar teste grátis <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[15px] gap-2 h-13 px-8 font-semibold">
                <WhatsAppLogo className="h-5 w-5" /> Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0a0e18] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="space-y-4">
              <TyposLogo size="sm" showCredit className="[&_span]:text-white [&_.text-muted-foreground\\/60]:text-white/50" />
              <p className="text-sm text-white/30 leading-relaxed">
                Sistema de gestão empresarial completo para o comércio brasileiro.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold mb-4 text-white/40 uppercase tracking-wider">Produto</h4>
              <ul className="space-y-2.5">
                {['PDV', 'Estoque', 'Fiscal', 'Chatbot IA', 'E-commerce', 'Relatórios'].map(l => (
                  <li key={l}><a href="#recursos" className="text-sm text-white/25 hover:text-white/60 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold mb-4 text-white/40 uppercase tracking-wider">Empresa</h4>
              <ul className="space-y-2.5">
                <li><a href="#depoimentos" className="text-sm text-white/25 hover:text-white/60 transition-colors">Depoimentos</a></li>
                <li><a href="#precos" className="text-sm text-white/25 hover:text-white/60 transition-colors">Preços</a></li>
                <li><Link to="/docs/api" className="text-sm text-white/25 hover:text-white/60 transition-colors">Documentação API</Link></li>
                <li><Link to="/termos" className="text-sm text-white/25 hover:text-white/60 transition-colors">Termos de Uso</Link></li>
                <li><Link to="/privacidade" className="text-sm text-white/25 hover:text-white/60 transition-colors">Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold mb-4 text-white/40 uppercase tracking-wider">Contato</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-white/25 hover:text-white/60 transition-colors">
                    <WhatsAppLogo className="h-4 w-4" /> WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:contato@typoserp.com.br" className="text-sm text-white/25 hover:text-white/60 transition-colors">
                    contato@typoserp.com.br
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/15">
              © {new Date().getFullYear()} Typos! ERP — Todos os direitos reservados. Desenvolvido por Leonardo Junio Andrade.
            </p>
            <div className="flex items-center gap-5">
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/50 transition-colors" aria-label="Instagram">
                  <InstagramLogo className="h-5 w-5" />
                </a>
              )}
              {socialLinks.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/50 transition-colors" aria-label="Facebook">
                  <FacebookLogo className="h-5 w-5" />
                </a>
              )}
              {socialLinks.linkedin && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/50 transition-colors" aria-label="LinkedIn">
                  <LinkedInLogo className="h-5 w-5" />
                </a>
              )}
              <Link to="/termos" className="text-xs text-white/15 hover:text-white/40 transition-colors">Termos</Link>
              <Link to="/privacidade" className="text-xs text-white/15 hover:text-white/40 transition-colors">Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== FLOATING WHATSAPP ===== */}
      {!whatsappBubbleDismissed && (
        <div className="fixed bottom-[5.5rem] right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg max-w-[200px]">
            <button onClick={() => setWhatsappBubbleDismissed(true)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors">
              <X className="h-3 w-3" />
            </button>
            <p className="text-xs font-medium text-foreground leading-snug">Fale com nosso time! 💬</p>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-card border-r border-b border-border rotate-45 rounded-br-sm" />
          </div>
        </div>
      )}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        aria-label="Falar no WhatsApp"
      >
        <WhatsAppLogo className="h-7 w-7" />
      </a>
    </div>
  );
}

/* ——— Segmentos Section ——— */
function SegmentosSection() {
  const [active, setActive] = useState(0);
  const seg = segmentos[active];

  return (
    <section className="py-20 sm:py-28 bg-[#0f1420] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Segmentos</span>
          <h2 className="text-3xl sm:text-[2.5rem] font-black tracking-tight">Para qual segmento é o Typos! ERP?</h2>
          <p className="mt-3 text-white/40 text-lg">Nosso sistema atende diversos tipos de negócio.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-14">
          {segmentos.map((s, i) => (
            <button
              key={s.tab}
              onClick={() => setActive(i)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                active === i
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 border border-white/[0.06]'
              }`}
            >
              {s.tab}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start" key={active}>
          <div className="animate-fade-in">
            <h3 className="text-2xl sm:text-3xl font-black mb-6 tracking-tight">{seg.title}</h3>
            <ul className="space-y-4">
              {seg.bullets.map(b => (
                <li key={b} className="flex items-start gap-3 text-white/60">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 mt-8">
              {seg.niches.map(n => (
                <span key={n} className="rounded-full border border-primary/20 bg-primary/[0.04] px-4 py-1.5 text-xs font-semibold text-primary/80">
                  {n}
                </span>
              ))}
            </div>

            <Link to="/onboarding" className="inline-block mt-8">
              <Button className="rounded-full px-8 h-12 font-bold bg-primary text-primary-foreground hover:bg-primary/90 group gap-2">
                Testar grátis por 7 dias <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="animate-fade-in">
            <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
              <img src={dashboardIaImg} alt={`${seg.title} — Typos! ERP com IA`} className="w-full" loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——— Dynamic Pricing (planos vindo do banco) ——— */
function DynamicPricing() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[400px] rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  // Fallback labels para features (caso não tenha highlights)
  const featureLabels: Record<string, string> = {
    pdv: 'PDV Completo', pdv_rapido: 'PDV Rápido', products: 'Produtos',
    categories: 'Categorias', inventory: 'Estoque', customers: 'Clientes',
    suppliers: 'Fornecedores', sales: 'Vendas', cash_register: 'Caixa',
    finance_basic: 'Financeiro', crediario: 'Crediário',
    fiscal_basic: 'Fiscal NFC-e', fiscal_entries: 'NF-e Entrada',
    quotes: 'Orçamentos', purchase_orders: 'Pedidos de Compra',
    replenishment: 'Reposição', store_transfers: 'Transferências',
    commissions: 'Comissões', returns: 'Devoluções', labels: 'Etiquetas',
    import_export: 'Importação em massa', multi_store: 'Multi-loja',
    priority_support: 'Suporte prioritário', whatsapp_chatbot: 'WhatsApp + IA',
    ecommerce: 'E-commerce', logistics: 'Logística', assemblies: 'Montagens',
    ai_simulation: 'Simulação IA', max_support: 'Suporte 24/7',
    reports_basic: 'Relatórios', reports_advanced: 'Relatórios avançados',
    sellers: 'Vendedores', variants: 'Variações', product_groups: 'Grupos',
  };

  const len = plans.length;
  const cols = len === 1 ? 'grid-cols-1' : len === 2 ? 'md:grid-cols-2' : len === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid gap-4 max-w-6xl mx-auto ${cols}`}>
      {plans.map((p, idx) => {
        const highlights: string[] = (p.landing_highlights && p.landing_highlights.length > 0)
          ? p.landing_highlights
          : [
              ...(p.features || []).slice(0, 8).map((f: string) => featureLabels[f] || f),
              `Até ${p.max_users} usuários${p.max_stores > 1 ? ` / ${p.max_stores} lojas` : ''}`,
            ];
        const isPremium = idx === plans.length - 1; // último plano = visual premium
        return (
          <PricingCard
            key={p.id}
            name={p.name}
            tagline={p.landing_subtitle || p.description || ''}
            price={Number(p.price)}
            features={highlights}
            planSlug={p.slug}
            popular={!!p.is_featured}
            premium={!p.is_featured && isPremium}
            ctaLabel={p.landing_cta_label || 'Começar grátis'}
          />
        );
      })}
    </div>
  );
}

/* ——— Pricing Card ——— */
function PricingCard({ name, tagline, price, features, planSlug, popular, premium, ctaLabel }: {
  name: string; tagline: string; price: number; features: string[]; planSlug: string; popular?: boolean; premium?: boolean; ctaLabel?: string;
}) {
  return (
    <div className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 group
      ${popular
        ? 'bg-background border-2 border-primary shadow-lg'
        : premium
          ? 'bg-[#0f1420] border border-white/[0.08] text-white'
          : 'bg-background border border-border hover:border-border/80 hover:shadow-lg'}
    `}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Mais popular
        </div>
      )}

      <h3 className={`text-base font-bold ${premium ? 'text-white' : 'text-foreground'}`}>{name}</h3>
      <p className={`text-xs mt-1 ${premium ? 'text-white/35' : 'text-muted-foreground'}`}>{tagline}</p>

      <div className="mt-5 mb-5">
        <span className={`text-3xl font-black ${premium ? 'text-white' : 'text-foreground'}`}>R$ {price}</span>
        <span className={`text-sm ${premium ? 'text-white/35' : 'text-muted-foreground'}`}>/mês</span>
      </div>

      <ul className="space-y-2 flex-1 text-sm">
        <li className={`flex items-start gap-2 font-semibold ${premium ? 'text-white' : 'text-foreground'}`}>
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>Inteligência Artificial com Simulação de Ambiente</span>
        </li>
        {features.filter(f => !/intelig.ncia artificial|simula..o.*ambiente|simula..o ia/i.test(f)).map(f => (
          <li key={f} className={`flex items-start gap-2 ${premium ? 'text-white/50' : 'text-muted-foreground'}`}>
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
          </li>
        ))}
      </ul>

      <p className={`text-[10px] italic mt-3 ${premium ? 'text-white/40' : 'text-muted-foreground'}`}>
        * Recursos de IA estão sujeitos ao consumo de créditos.
      </p>

      <Link to={`/login?plan=${planSlug}`} className="mt-6">
        <Button className={`w-full rounded-full font-bold h-11 transition-all
          ${popular
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : premium
              ? 'bg-white text-[#0f1420] hover:bg-white/90'
              : 'bg-foreground text-background hover:bg-foreground/90'
          }
        `}>
          {ctaLabel || 'Começar grátis'}
        </Button>
      </Link>
    </div>
  );
}
