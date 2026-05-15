import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCircle, ShoppingBag, CreditCard, Phone, Mail, FileText, Link2, Plus, ExternalLink, Brain, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversation } from './ChatConversationList';

interface Props {
  conversation: Conversation;
  accountId: string;
  onLinkSale: () => void;
  onCreateSale: () => void;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  credit_limit: number;
  credit_authorized: boolean;
}

interface SaleData {
  id: string;
  order_number: number | null;
  total: number;
  status: string;
  created_at: string;
}

interface AiProfile {
  display_name: string | null;
  preferred_greeting: string | null;
  communication_style: string | null;
  preferred_brands: string[] | null;
  preferred_categories: string[] | null;
  disliked_items: string[] | null;
  frequent_products: string[] | null;
  notes_summary: string | null;
  total_interactions: number;
  last_interaction_at: string | null;
}

export default function ChatCustomerPanel({ conversation, accountId, onLinkSale, onCreateSale }: Props) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [recentSales, setRecentSales] = useState<SaleData[]>([]);
  const [linkedSale, setLinkedSale] = useState<SaleData | null>(null);
  const [aiProfile, setAiProfile] = useState<AiProfile | null>(null);

  useEffect(() => {
    if (conversation.customer_id) {
      loadCustomer(conversation.customer_id);
      loadRecentSales(conversation.customer_id);
    }
    if (conversation.sale_id) {
      loadLinkedSale(conversation.sale_id);
    }
    loadAiProfile();
  }, [conversation.customer_id, conversation.sale_id, conversation.phone]);

  const loadAiProfile = async () => {
    if (!conversation.phone) return;
    const { data } = await supabase
      .from('customer_ai_profiles')
      .select('display_name, preferred_greeting, communication_style, preferred_brands, preferred_categories, disliked_items, frequent_products, notes_summary, total_interactions, last_interaction_at')
      .eq('account_id', accountId)
      .eq('phone', conversation.phone)
      .maybeSingle();
    setAiProfile(data as AiProfile | null);
  };

  const loadCustomer = async (id: string) => {
    const { data } = await supabase.from('customers').select('id, name, phone, email, document, credit_limit, credit_authorized').eq('id', id).single();
    setCustomer(data);
  };

  const loadRecentSales = async (customerId: string) => {
    const { data } = await supabase
      .from('sales')
      .select('id, order_number, total, status, created_at')
      .eq('customer_id', customerId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentSales(data || []);
  };

  const loadLinkedSale = async (saleId: string) => {
    const { data } = await supabase.from('sales').select('id, order_number, total, status, created_at').eq('id', saleId).single();
    setLinkedSale(data);
  };

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada',
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', open: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700', canceled: 'bg-red-100 text-red-700',
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Customer Info */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cliente</h3>
          {customer ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{customer.name}</p>
                  {customer.document && <p className="text-[10px] text-muted-foreground">{customer.document}</p>}
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {customer.email}
                </div>
              )}
              {customer.credit_authorized && (
                <div className="flex items-center gap-1.5 text-xs">
                  <CreditCard className="h-3 w-3 text-green-600" />
                  <span>Crediário: R$ {customer.credit_limit.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Cliente não vinculado</p>
          )}
        </div>

        <Separator />

        {/* AI Learned Profile */}
        {aiProfile && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Brain className="h-3 w-3 text-primary" /> IA aprendeu
                {aiProfile.total_interactions > 0 && (
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {aiProfile.total_interactions} conversa{aiProfile.total_interactions > 1 ? 's' : ''}
                  </Badge>
                )}
              </h3>
              <div className="space-y-1.5 text-xs bg-primary/5 p-2 rounded-lg border border-primary/10">
                {aiProfile.preferred_greeting && (
                  <p><span className="text-muted-foreground">Cumprimento:</span> <span className="font-medium">{aiProfile.preferred_greeting}</span></p>
                )}
                {aiProfile.communication_style && (
                  <p><span className="text-muted-foreground">Estilo:</span> <span className="font-medium">{aiProfile.communication_style}</span></p>
                )}
                {aiProfile.preferred_brands && aiProfile.preferred_brands.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Marcas favoritas:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {aiProfile.preferred_brands.slice(0, 6).map(b => (
                        <Badge key={b} variant="secondary" className="text-[9px]">{b}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.preferred_categories && aiProfile.preferred_categories.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Categorias:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {aiProfile.preferred_categories.slice(0, 6).map(c => (
                        <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.frequent_products && aiProfile.frequent_products.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Compra com frequência:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {aiProfile.frequent_products.slice(0, 5).map(p => (
                        <Badge key={p} variant="outline" className="text-[9px] bg-green-50 dark:bg-green-950/20">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.disliked_items && aiProfile.disliked_items.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Não gosta:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {aiProfile.disliked_items.slice(0, 4).map(d => (
                        <Badge key={d} variant="outline" className="text-[9px] bg-red-50 dark:bg-red-950/20">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {aiProfile.notes_summary && (
                  <p className="pt-1 border-t border-primary/10 text-[11px] italic flex gap-1">
                    <Sparkles className="h-3 w-3 shrink-0 text-primary mt-0.5" />
                    <span>{aiProfile.notes_summary}</span>
                  </p>
                )}
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Linked Sale */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Venda vinculada</h3>
          {linkedSale ? (
            <div className="p-2 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">#{linkedSale.order_number}</span>
                <Badge className={`text-[10px] ${statusColor[linkedSale.status] || ''}`}>
                  {statusLabel[linkedSale.status] || linkedSale.status}
                </Badge>
              </div>
              <p className="text-xs">R$ {linkedSale.total.toFixed(2).replace('.', ',')}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(linkedSale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground italic">Nenhuma venda vinculada</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={onLinkSale}>
                  <Link2 className="h-3 w-3 mr-1" /> Vincular
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={onCreateSale}>
                  <Plus className="h-3 w-3 mr-1" /> Nova venda
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Recent Sales */}
        {customer && recentSales.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <ShoppingBag className="h-3 w-3 inline mr-1" /> Últimas compras
            </h3>
            <div className="space-y-1.5">
              {recentSales.map(sale => (
                <div key={sale.id} className="p-1.5 border rounded text-xs flex items-center justify-between">
                  <div>
                    <span className="font-medium">#{sale.order_number}</span>
                    <span className="ml-2 text-muted-foreground">
                      R$ {sale.total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${statusColor[sale.status] || ''}`}>
                    {statusLabel[sale.status] || sale.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
