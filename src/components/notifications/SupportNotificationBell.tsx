import { useEffect, useState, useCallback } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingTicket {
  id: string;
  ticket_number: number;
  subject: string;
  category: string;
  status: string;
  client_unread_count: number;
  support_unread_count: number;
  last_message_at: string;
}

interface ActionAlert {
  id: string;
  ticket_id: string;
  account_id: string;
  severity: string;
  reason: string | null;
  matched_keywords: string[];
  created_at: string;
  ticket?: { ticket_number: number; subject: string; category: string } | null;
}

const SEV_COLOR: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  urgent: 'bg-destructive/15 text-destructive',
};
const SEV_LABEL: Record<string, string> = {
  low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'URGENTE',
};

/**
 * In-app bell that surfaces support tickets needing the current user's
 * attention, plus action-rule alerts. Updates in real time.
 */
export function SupportNotificationBell({
  isSuperAdmin = false,
  onOpenTicket,
}: {
  isSuperAdmin?: boolean;
  onOpenTicket?: (ticketId: string) => void;
}) {
  const { user, currentAccount } = useAuth();
  const [tickets, setTickets] = useState<PendingTicket[]>([]);
  const [alerts, setAlerts] = useState<ActionAlert[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    let q = supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, status, client_unread_count, support_unread_count, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(20);

    if (isSuperAdmin) {
      q = q.gt('support_unread_count', 0);
    } else {
      if (!currentAccount?.id) return;
      q = q.eq('account_id', currentAccount.id).gt('client_unread_count', 0);
    }
    const { data } = await q;
    setTickets((data as any[]) || []);

    // Action alerts (open / not acknowledged)
    let aq = supabase
      .from('support_action_alerts' as any)
      .select('id, ticket_id, account_id, severity, reason, matched_keywords, created_at, ticket:support_tickets(ticket_number, subject, category)')
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!isSuperAdmin && currentAccount?.id) {
      aq = aq.eq('account_id', currentAccount.id);
    }
    const { data: alertsData } = await aq;
    setAlerts((alertsData as any[]) || []);
  }, [user, isSuperAdmin, currentAccount?.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('support-bell-' + (user?.id || 'anon'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_action_alerts' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user?.id]);

  const totalUnread = tickets.reduce(
    (acc, t) => acc + (isSuperAdmin ? t.support_unread_count : t.client_unread_count),
    0,
  );
  const totalBadge = totalUnread + alerts.length;

  const handleClickTicket = (id: string) => {
    setOpen(false);
    if (onOpenTicket) onOpenTicket(id);
    else window.dispatchEvent(new CustomEvent('open-support-ticket', { detail: { ticketId: id } }));
  };

  const handleClickAlert = async (a: ActionAlert) => {
    handleClickTicket(a.ticket_id);
    await supabase.rpc('acknowledge_support_action_alert' as any, { _alert_id: a.id });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {totalBadge > 0 && (
            <Badge
              variant="destructive"
              className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold flex items-center justify-center rounded-full ${alerts.length > 0 ? 'animate-pulse' : ''}`}
            >
              {totalBadge > 99 ? '99+' : totalBadge}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin ? 'Tickets aguardando sua resposta' : 'Atualizações dos seus chamados'}
          </p>
        </div>
        <ScrollArea className="max-h-[420px]">
          {alerts.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-destructive/5 border-b border-destructive/10 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[11px] font-bold text-destructive uppercase tracking-wide">
                  {alerts.length} ticket{alerts.length > 1 ? 's' : ''} exige{alerts.length > 1 ? 'm' : ''} ação
                </span>
              </div>
              <ul className="divide-y">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => handleClickAlert(a)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">#{a.ticket?.ticket_number}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLOR[a.severity] || ''}`}>
                          {SEV_LABEL[a.severity] || a.severity}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{a.ticket?.subject || 'Ticket'}</p>
                      {a.reason && (
                        <p className="text-[11px] text-muted-foreground truncate">{a.reason}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tickets.length === 0 && alerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma novidade no momento.
            </div>
          ) : tickets.length > 0 ? (
            <div>
              {alerts.length > 0 && (
                <div className="px-3 py-1.5 bg-muted/40 border-b">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Mensagens não lidas
                  </span>
                </div>
              )}
              <ul className="divide-y">
                {tickets.map((t) => {
                  const count = isSuperAdmin ? t.support_unread_count : t.client_unread_count;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => handleClickTicket(t.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</span>
                            {t.category === 'feature_request' && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">Ajuste técnico</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{t.subject}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] h-5 min-w-5 px-1.5 rounded-full">
                          {count}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
