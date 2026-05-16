import { TyposLogo } from '@/components/brand/TyposLogo';
import loginBg from '@/assets/login-bg.jpg';
import {
  ShoppingCart, Package, BarChart3, Users, Truck, Receipt,
  Shield, Smartphone, Tags, Calculator,
} from 'lucide-react';

const features = [
  { icon: ShoppingCart, label: 'PDV Completo' },
  { icon: Package, label: 'Estoque Inteligente' },
  { icon: BarChart3, label: 'Relatórios & Dashboard' },
  { icon: Users, label: 'Multi-Lojas & Equipes' },
  { icon: Truck, label: 'Entregas & Logística' },
  { icon: Receipt, label: 'NFC-e / NF-e Integrada' },
  { icon: Shield, label: 'Segurança com PIN' },
  { icon: Smartphone, label: 'Chatbot WhatsApp' },
  { icon: Tags, label: 'Etiquetas & Códigos' },
  { icon: Calculator, label: 'Comissões & Crediário' },
];

export function AuthBrandPanel() {
  return (
    <section className="relative hidden h-full overflow-hidden rounded-3xl lg:flex lg:flex-col lg:items-center lg:justify-center">
      {/* Background image */}
      <img
        src={loginBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
        <TyposLogo size="lg" showCredit className="drop-shadow-lg" />

        <p className="max-w-sm text-base font-medium text-white/80 leading-relaxed">
          Gestão comercial completa para o seu negócio — do caixa ao fiscal, tudo em um só lugar.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full max-w-sm">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C45E1A]/20 backdrop-blur">
                <Icon className="h-4 w-4 text-[#D4722E]" />
              </div>
              <span className="text-sm font-medium text-white/90">{label}</span>
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-white/40 tracking-wide">
          © {new Date().getFullYear()} Typos! ERP — By Leonardo Andrade
        </p>
      </div>
    </section>
  );
}
