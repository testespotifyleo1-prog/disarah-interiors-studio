import { Construction, ExternalLink, ArrowRight, Sparkles, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShopeeLogo, MercadoPagoLogo, MercadoLivreLogo } from '@/components/brand/BrandLogos';
import amazonLogo from '@/assets/logos/amazon-official.png';
import magaluLogo from '@/assets/logos/magalu-official.png';
import melhorEnvioLogo from '@/assets/logos/melhor-envio-official.png';
import uberDirectLogo from '@/assets/logos/uber-direct-official.png';
import { useAuth } from '@/contexts/AuthContext';
import { isModuleDisabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';

const BrandLogo = ({ src, alt, bg }: { src: string; alt: string; bg?: string }) => (
  <div className={`h-14 w-14 rounded-lg flex items-center justify-center overflow-hidden ${bg || 'bg-white border border-border'}`}>
    <img src={src} alt={alt} loading="lazy" className="h-12 w-12 object-contain" />
  </div>
);

const integrations = [
  {
    id: 'mercado-livre',
    name: 'Mercado Livre',
    description: 'Integre seus produtos com o Mercado Livre e venda diretamente na plataforma. Estoque, pedidos e preços sincronizados automaticamente com seu ERP.',
    color: '#FFE600',
    bgColor: 'bg-[#FFE600]/10',
    borderColor: 'border-[#FFE600]/30',
    logo: <MercadoLivreLogo className="h-14 w-14" />,
    available: true,
    href: '/app/integrations/mercado-livre',
    features: [
      'Sincronização de produtos e estoque',
      'Recebimento automático de pedidos',
      'Baixa de estoque em tempo real',
      'Gestão de preços centralizada',
    ],
  } as any,
  {
    id: 'shopee',
    name: 'Shopee',
    description: 'Conecte sua loja à Shopee e gerencie tudo pelo ERP. Publique produtos, receba pedidos e controle estoque de forma unificada.',
    color: '#EE4D2D',
    bgColor: 'bg-[#EE4D2D]/10',
    borderColor: 'border-[#EE4D2D]/30',
    logo: <ShopeeLogo className="h-14 w-14" />,
    available: true,
    href: '/app/integrations/shopee',
    features: [
      'Publicação automática de produtos',
      'Sincronização de pedidos e estoque',
      'Controle de envios integrado',
      'Relatórios unificados no ERP',
    ],
  } as any,
  {
    id: 'mercado-pago',
    name: 'Mercado Pago',
    description: 'Aceite pagamentos via Mercado Pago diretamente no seu PDV e loja online. Pix, cartão e boleto com conciliação automática.',
    color: '#00B1EA',
    bgColor: 'bg-[#00B1EA]/10',
    borderColor: 'border-[#00B1EA]/30',
    logo: <MercadoPagoLogo className="h-14 w-14" />,
    available: true,
    href: '/app/integrations/mercado-pago',
    features: [
      'Pagamento via Pix, cartão de crédito e débito',
      'Conciliação automática de recebimentos',
      'Integração com PDV, e-commerce e maquininha Point',
      'Relatórios financeiros integrados',
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Venda no maior marketplace do mundo. Sincronize produtos, estoque e pedidos com sua conta Amazon Seller Central Brasil.',
    color: '#FF9900',
    bgColor: 'bg-[#FF9900]/10',
    borderColor: 'border-[#FF9900]/30',
    logo: <BrandLogo src={amazonLogo} alt="Amazon" />,
    available: true,
    href: '/app/integrations/amazon',
    features: ['Publicação automática SP-API', 'Pedidos e estoque sincronizados', 'Suporte a FBA e FBM', 'Marketplace Brasil A2Q3Y263D00KWC'],
  } as any,
  {
    id: 'magalu',
    name: 'Magazine Luiza',
    description: 'Conecte ao maior marketplace brasileiro. Publique produtos no Magalu Marketplace direto do ERP.',
    color: '#0086FF',
    bgColor: 'bg-[#0086FF]/10',
    borderColor: 'border-[#0086FF]/30',
    logo: <BrandLogo src={magaluLogo} alt="Magazine Luiza" bg="bg-[#0086FF]" />,
    available: true,
    href: '/app/integrations/magalu',
    features: ['OAuth oficial Magalu Marketplace', 'Sincronização de catálogo', 'Recebimento de pedidos via webhook', 'Atualização automática de estoque'],
  } as any,
  {
    id: 'melhor-envio',
    name: 'Melhor Envio',
    description: 'Cotação multi-transportadora: Correios PAC/SEDEX, Jadlog, Loggi, Azul Cargo, J&T. Uma integração, todas as opções.',
    color: '#0D6EFD',
    bgColor: 'bg-[#0D6EFD]/10',
    borderColor: 'border-[#0D6EFD]/30',
    logo: <BrandLogo src={melhorEnvioLogo} alt="Melhor Envio" />,
    available: true,
    href: '/app/integrations/melhor-envio',
    features: ['Cotação real-time no checkout', 'Compra de etiqueta automatizada', 'Rastreamento integrado', 'Toggle por transportadora'],
  } as any,
  {
    id: 'uber-direct',
    name: 'Uber Direct',
    description: 'Entrega on-demand local. Cliente compra de manhã, recebe à tarde. Motoboy/carro Uber para o seu cliente.',
    color: '#000000',
    bgColor: 'bg-black/5',
    borderColor: 'border-black/30',
    logo: <BrandLogo src={uberDirectLogo} alt="Uber Direct" />,
    available: true,
    href: '/app/integrations/uber-direct',
    features: ['Cotação em tempo real', 'Entrega same-day local', 'Rastreamento do motorista', 'Cobrança via fatura mensal'],
  } as any,
];

export default function Integrations() {
  const { currentAccount } = useAuth();
  const moduleBlocked = isModuleDisabled(currentAccount, 'integrations');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Conecte sua loja a marketplaces e meios de pagamento para expandir suas vendas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration: any) => {
          const isAvailable = !!integration.available;
          return (
            <Card
              key={integration.id}
              className={`relative overflow-hidden border-2 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg group ${
                isAvailable
                  ? 'border-primary/30 hover:border-primary'
                  : 'border-dashed border-muted-foreground/20 hover:border-muted-foreground/40'
              }`}
            >
              <div className="absolute top-3 right-3">
                {isAvailable ? (
                  <Badge className="gap-1 text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    <Sparkles className="h-3 w-3" />
                    Disponível
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 border-amber-200">
                    <Construction className="h-3 w-3" />
                    Em desenvolvimento
                  </Badge>
                )}
              </div>

              <CardHeader className="pb-3 pt-5">
                <div className="mb-3 group-hover:scale-110 transition-transform duration-300">
                  {integration.logo}
                </div>
                <CardTitle className="text-lg">{integration.name}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {integration.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  O que você terá:
                </p>
                <ul className="space-y-1.5">
                  {integration.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isAvailable && !moduleBlocked ? (
                  <Link
                    to={integration.href}
                    className="w-full mt-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    Configurar integração
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : moduleBlocked ? (
                  <button
                    disabled
                    title={MODULE_BLOCKED_MESSAGE}
                    className="w-full mt-5 py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Bloqueado
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full mt-5 py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Construction className="h-4 w-4" />
                    Em breve
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
