import { Link, useLocation } from 'react-router-dom';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { LogOut, ChevronDown, Search, X, UserCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { isModuleDisabled, isAiBlocked, AI_BLOCKED_MESSAGE, MODULE_BLOCKED_MESSAGE, type ModuleType } from '@/utils/accountModules';
import { usePlan } from '@/contexts/PlanContext';

import { useState, useMemo } from 'react';
import { getMenuIcons, type MenuTheme } from '@/utils/menuIcons';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';

type QuickAction = { iconKey: string; label: string; href: string };
type MenuItem = { iconKey: string; label: string; href: string; roles?: string[] };
type MenuGroup = { id: string; label: string; iconKey: string; items: MenuItem[]; sellerLabel?: string; isNew?: boolean };

const quickActions: QuickAction[] = [
  { iconKey: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { iconKey: 'pdv', label: 'PDV', href: '/app/pdv' },
  { iconKey: 'pdvRapido', label: 'Rápida', href: '/app/pdv-rapido' },
  { iconKey: 'sales', label: 'Vendas', href: '/app/sales' },
  { iconKey: 'cash', label: 'Caixa', href: '/app/caixa' },
];

const menuGroups: MenuGroup[] = [
  {
    id: 'catalog',
    label: 'Produtos & Estoque',
    iconKey: 'catalog',
    items: [
      { iconKey: 'products', label: 'Produtos', href: '/app/products' },
      { iconKey: 'categories', label: 'Categorias', href: '/app/categories' },
      { iconKey: 'inventory', label: 'Estoque', href: '/app/inventory' },
      { iconKey: 'transfers', label: 'Transferências', href: '/app/transfers', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'labels', label: 'Etiquetas', href: '/app/labels' },
      { iconKey: 'expiration', label: 'Validades', href: '/app/expiration-report' },
      
    ],
  },
  {
    id: 'crm',
    label: 'Clientes & CRM',
    iconKey: 'customers',
    items: [
      { iconKey: 'customers', label: 'Clientes', href: '/app/customers' },
      { iconKey: 'crediario', label: 'Crediário', href: '/app/crediario', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'storeCredits', label: 'Créditos de Loja', href: '/app/store-credits', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'customerReturns', label: 'Trocas & Garantias', href: '/app/customer-returns', roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    id: 'commercial',
    label: 'Comercial & Compras',
    iconKey: 'commercial',
    items: [
      { iconKey: 'quotes', label: 'Orçamentos', href: '/app/quotes' },
      { iconKey: 'suppliers', label: 'Fornecedores', href: '/app/suppliers', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'purchaseOrders', label: 'Pedidos de Compra', href: '/app/purchase-orders', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'replenishment', label: 'Sugestão Reposição', href: '/app/replenishment', roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    id: 'team',
    label: 'Equipe & Financeiro',
    sellerLabel: 'Financeiro',
    iconKey: 'team',
    items: [
      { iconKey: 'sellers', label: 'Vendedores', href: '/app/sellers', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'commissionTiers', label: 'Faixas de Comissão', href: '/app/commission-tiers', roles: ['owner', 'admin'] },
      { iconKey: 'salesGoals', label: 'Metas de Vendas', href: '/app/sales-goals', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'finance', label: 'Financeiro', href: '/app/finance', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'myCommissions', label: 'Minhas Comissões', href: '/app/my-commissions', roles: ['seller', 'manager'] },
    ],
  },
  {
    id: 'logistics',
    label: 'Logística',
    iconKey: 'logistics',
    items: [
      { iconKey: 'picking', label: 'Expedição (Picking)', href: '/app/picking', roles: ['owner', 'admin', 'manager', 'seller'] },
      { iconKey: 'drivers', label: 'Entregadores', href: '/app/drivers', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'deliveries', label: 'Entregas', href: '/app/deliveries' },
      { iconKey: 'assemblers', label: 'Montadores', href: '/app/assemblers', roles: ['owner', 'admin', 'manager'] },
      { iconKey: 'assemblies', label: 'Montagens', href: '/app/assemblies' },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    iconKey: 'fiscal',
    items: [
      { iconKey: 'fiscalSettings', label: 'Configurações Fiscais', href: '/app/settings/fiscal', roles: ['owner', 'admin'] },
      { iconKey: 'fiscalCounter', label: 'Dashboard Fiscal', href: '/app/fiscal-dashboard', roles: ['owner', 'admin'] },
      { iconKey: 'fiscalCounter', label: 'Contador Fiscal', href: '/app/fiscal-counter', roles: ['owner', 'admin'] },
      { iconKey: 'fiscalEntries', label: 'Entradas (NFe)', href: '/app/fiscal-entries', roles: ['owner', 'admin'] },
      { iconKey: 'fiscalReturns', label: 'Devolução Cliente', href: '/app/fiscal-returns', roles: ['owner', 'admin'] },
      { iconKey: 'supplierReturns', label: 'Devolução Fornecedor', href: '/app/supplier-returns', roles: ['owner', 'admin'] },
      { iconKey: 'fiscalSettings', label: 'Ferramentas Avançadas', href: '/app/fiscal-extras', roles: ['owner', 'admin'] },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    iconKey: 'settings',
    items: [
      { iconKey: 'stores', label: 'Lojas', href: '/app/stores', roles: ['owner', 'admin'] },
      { iconKey: 'businessType', label: 'Tipo de Negócio', href: '/app/settings/business-type', roles: ['owner', 'admin'] },
      { iconKey: 'pin', label: 'PIN de Autorização', href: '/app/settings/pin', roles: ['owner', 'manager'] },
      { iconKey: 'activityLogs', label: 'Log de Atividades', href: '/app/activity-logs', roles: ['owner', 'admin'] },
      { iconKey: 'ecommerce', label: 'Personalizar Site', href: '/app/site/settings', roles: ['owner', 'admin'] },
      { iconKey: 'categories', label: 'Galeria do Site', href: '/app/site/galeria', roles: ['owner', 'admin'] },
      { iconKey: 'reset', label: 'Resetar Dados', href: '/app/settings/reset', roles: ['owner'] },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { currentAccount, userRole, signOut } = useAuth();
  const hasFeature = (_f: string) => true;
  const menuTheme = ((currentAccount as any)?.menu_theme as MenuTheme) || 'party';
  const icons = useMemo(() => getMenuIcons(menuTheme), [menuTheme]);
  const waUnread = 0;
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand the group containing the current route
    const active = menuGroups.find(g => g.items.some(i => location.pathname === i.href));
    return active ? [active.id] : ['catalog'];
  });
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const isActive = (href: string) => location.pathname === href;

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  // Items mantidos visíveis mas bloqueados (com cadeado/tooltip) quando módulo desabilitado.
  // Nota: 'assemblies' continua sendo escondido (comportamento legado).
  const ROUTE_MODULE_MAP: Record<string, ModuleType> = {
    '/app/crediario': 'crediario',
  };

  const getBlockedInfo = (href: string): { blocked: boolean; message: string } => {
    const mod = ROUTE_MODULE_MAP[href];
    if (!mod) return { blocked: false, message: '' };
    if (!isModuleDisabled(currentAccount, mod)) return { blocked: false, message: '' };
    return { blocked: true, message: mod === 'ai_features' ? AI_BLOCKED_MESSAGE : MODULE_BLOCKED_MESSAGE };
  };

  const filterByRole = <T extends { roles?: string[]; href?: string }>(items: T[]): T[] =>
    items.filter(item => {
      if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
      const href = item.href || '';
      // Assemblies continuam ocultos (comportamento legado para contas sem montagem).
      if ((href.includes('assembl') || href.includes('montag')) && isModuleDisabled(currentAccount, 'assemblies')) return false;

      // Plan-based feature gating removed (single-tenant: full access)

      return true;
    });

  const visibleGroups = menuGroups
    .map(g => {
      const roleFiltered = filterByRole(g.items);
      // Apply search filter on item label (and group label as fallback match)
      const groupLabel = (userRole === 'seller' && g.sellerLabel ? g.sellerLabel : g.label).toLowerCase();
      const items = normalizedSearch
        ? roleFiltered.filter(i =>
            i.label.toLowerCase().includes(normalizedSearch) ||
            groupLabel.includes(normalizedSearch)
          )
        : roleFiltered;
      return { ...g, items };
    })
    .filter(g => g.items.length > 0);

  // When searching, auto-expand all matching groups
  const effectiveExpanded = normalizedSearch
    ? visibleGroups.map(g => g.id)
    : expandedGroups;

  return (
    <Sidebar>
      {/* Brand Header */}
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <Link to="/app/dashboard" className="flex items-center gap-2 group">
          <div className="flex flex-col min-w-0">
            <TyposLogo size="sm" showCredit />
            <span className="text-[11px] text-sidebar-foreground/50 truncate max-w-[130px] font-medium mt-0.5">
              {currentAccount?.name || 'Sem conta'}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 scrollbar-thin">
        {/* Search */}
        <div className="px-1 mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40 pointer-events-none" />
            <input
              type="search"
              name="sidebar-menu-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no menu..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/40 text-[12px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/40 focus:border-sidebar-primary/40 transition-all [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions - Pill Grid (hidden during search) */}
        {!normalizedSearch && (
          <div className="grid grid-cols-5 gap-1 px-1 mb-4">
            {quickActions
              .filter(item => {
                if (item.href === '/app/pdv' && isModuleDisabled(currentAccount?.id, 'pdv_standard')) return false;
                return true;
              })
              .map((item) => {
                const label = item.href === '/app/pdv-rapido' && isModuleDisabled(currentAccount?.id, 'pdv_standard')
                  ? 'PDV'
                  : item.label;
                const Icon = icons[item.iconKey];
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[10px] font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/30'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                    )}
                  >
                    {Icon && <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
                    <span className="truncate w-full text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-sidebar-border/60 mx-2 mb-3" />

        {/* Accordion Groups */}
        <div className="space-y-0.5">
          {visibleGroups.length === 0 && normalizedSearch && (
            <div className="px-3 py-6 text-center text-[12px] text-sidebar-foreground/50">
              Nenhum item encontrado para "{search}"
            </div>
          )}
          {visibleGroups.map((group) => {
            const isExpanded = effectiveExpanded.includes(group.id);
            const hasActiveChild = group.items.some(i => isActive(i.href));
            const GroupIcon = icons[group.iconKey];

            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200',
                    hasActiveChild
                      ? 'text-sidebar-primary bg-sidebar-primary/10'
                      : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/40'
                  )}
                >
                  {GroupIcon && <GroupIcon style={{ width: 14, height: 14 }} className="shrink-0 opacity-70" />}
                  <span className="flex-1 text-left flex items-center gap-1.5">
                    {userRole === 'seller' && group.sellerLabel ? group.sellerLabel : group.label}
                    {(group as any).isNew && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase leading-none bg-primary text-primary-foreground animate-pulse">
                        Novo
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    style={{ width: 14, height: 14 }}
                    className={cn(
                      'shrink-0 transition-transform duration-300 opacity-50',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {/* Animated items */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="py-1 ml-3 pl-3 border-l border-sidebar-border/40 space-y-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = icons[item.iconKey];
                      const blockedInfo = getBlockedInfo(item.href);
                      if (blockedInfo.blocked) {
                        return (
                          <button
                            key={item.href}
                            type="button"
                            title={blockedInfo.message}
                            onClick={(e) => { e.preventDefault(); }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-sidebar-foreground/35 cursor-not-allowed hover:bg-sidebar-accent/30"
                          >
                            {ItemIcon && (
                              <ItemIcon style={{ width: 16, height: 16 }} className="shrink-0 opacity-40" />
                            )}
                            <span className="truncate">{item.label}</span>
                            <span className="ml-auto text-[9px] uppercase font-bold tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              Bloqueado
                            </span>
                          </button>
                        );
                      }
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 group/item',
                            isActive(item.href)
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm shadow-sidebar-primary/20'
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                          )}
                        >
                          {ItemIcon && (
                            <ItemIcon
                              style={{ width: 16, height: 16 }}
                              className={cn(
                                'shrink-0 transition-transform duration-150 group-hover/item:scale-110',
                                isActive(item.href) ? 'text-sidebar-primary-foreground' : 'opacity-60'
                              )}
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                          {item.href === '/app/chat' && waUnread > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold shadow-sm">
                              {waUnread > 99 ? '99+' : waUnread}
                            </span>
                          )}
                          {isActive(item.href) && item.href !== '/app/chat' && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary-foreground/80" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut style={{ width: 16, height: 16 }} />
          <span className="font-medium">Sair</span>
        </button>
        <div className="mt-2 pt-2 border-t border-sidebar-border/40 text-center">
          <p className="text-[10px] text-sidebar-foreground/30 font-medium tracking-wide">
            Desenvolvido por
          </p>
          <p className="text-[11px] text-sidebar-primary/70 font-semibold tracking-tight">
            Leonardo Junio Andrade
          </p>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <a href="https://linkedin.com/in/leonardo-junio-andrade" target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/40 hover:text-sidebar-primary transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://instagram.com/leonardojunioandrade" target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/40 hover:text-sidebar-primary transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
