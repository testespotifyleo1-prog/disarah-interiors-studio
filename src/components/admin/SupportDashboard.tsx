import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Send, MessageSquare, Clock, CheckCircle2,
  AlertCircle, Ticket, Search, Inbox, Paperclip, FileText, ImageIcon, X
} from 'lucide-react';

interface TicketRow {
  id: string;
  ticket_number: number;
  account_id: string;
  created_by: string;
  subject: string;
  status: string;
  priority: string;
  category?: string;
  created_at: string;
  last_message_at: string | null;
  client_unread_count?: number;
  support_unread_count?: number;
}

const categoryMap: Record<string, { label: string; className: string }> = {
  support: { label: 'Suporte', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  feature_request: { label: 'Ajuste técnico', className: 'bg-primary/10 text-primary border-primary/30' },
};

interface MsgRow {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_type: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
}

function AttachmentBubble({ url, type }: { url: string; type?: string | null }) {
  const isImage = type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(url);
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2 rounded-lg overflow-hidden border border-border/50 max-w-[260px]">
        <img src={url} alt="anexo" className="w-full h-auto object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs hover:bg-background/70 transition-colors">
      <FileText className="h-3.5 w-3.5" />
      <span>Abrir anexo</span>
    </a>
  );
}

const statusOptions = [
  { value: 'open', label: 'Aberto', variant: 'destructive' as const },
  { value: 'in_progress', label: 'Em Andamento', variant: 'default' as const },
  { value: 'resolved', label: 'Resolvido', variant: 'secondary' as const },
  { value: 'closed', label: 'Fechado', variant: 'outline' as const },
];

export function SupportDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [accounts, setAccounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const uploadAttachment = async (file: File, accountId: string): Promise<{ url: string | null; type: string }> => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${accountId}/admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('support-attachments').upload(path, file, { upsert: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar anexo', description: error.message });
      return { url: null, type: file.type };
    }
    const { data } = await supabase.storage.from('support-attachments').createSignedUrl(path, 60 * 60 * 24 * 30);
    return { url: data?.signedUrl || null, type: file.type };
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel('admin-support-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        loadTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
      const channel = supabase
        .channel(`admin-msgs-${selectedTicket.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as MsgRow]);
          setTimeout(scrollToBottom, 100);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedTicket?.id]);

  useEffect(scrollToBottom, [messages]);

  const loadTickets = async () => {
    const [{ data: ticketData }, { data: accountData }] = await Promise.all([
      supabase.from('support_tickets').select('*').order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase.from('accounts').select('id, name'),
    ]);
    setTickets((ticketData as any[]) || []);
    const map: Record<string, string> = {};
    (accountData || []).forEach((a: any) => { map[a.id] = a.name; });
    setAccounts(map);
    setLoading(false);
  };

  const loadMessages = async (ticketId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as any[]) || []);
    setMsgLoading(false);
    // Mark as read for the support side
    supabase.rpc('mark_support_ticket_read' as any, { _ticket_id: ticketId }).then(() => {});
  };

  const handleSendMessage = async () => {
    if ((!newMsg.trim() && !replyFile) || !selectedTicket || !user) return;
    setSending(true);

    let attachment_url: string | null = null;
    let attachment_type: string | null = null;
    if (replyFile) {
      const up = await uploadAttachment(replyFile, selectedTicket.account_id);
      attachment_url = up.url;
      attachment_type = up.type;
    }

    await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_name: 'Suporte Typos',
      sender_type: 'support',
      content: newMsg.trim() || (replyFile ? '📎 Anexo enviado' : ''),
      attachment_url,
      attachment_type,
    } as any);

    // Auto-set to in_progress if was open
    if (selectedTicket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress', last_message_at: new Date().toISOString() } as any)
        .eq('id', selectedTicket.id);
      setSelectedTicket({ ...selectedTicket, status: 'in_progress' });
    } else {
      await supabase
        .from('support_tickets')
        .update({ last_message_at: new Date().toISOString() } as any)
        .eq('id', selectedTicket.id);
    }

    // Send email notification to client (fire and forget)
    supabase.functions.invoke('send-support-email', {
      body: {
        type: 'new_message',
        ticket_id: selectedTicket.id,
        ticket_number: selectedTicket.ticket_number,
        subject: selectedTicket.subject,
        message: newMsg.trim() || '📎 Anexo enviado',
        sender_name: 'Suporte Typos',
        sender_type: 'support',
        created_by: selectedTicket.created_by,
      },
    }).catch(console.error);

    setNewMsg('');
    setReplyFile(null);
    setSending(false);
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const previousStatus = selectedTicket?.id === ticketId ? selectedTicket.status : tickets.find(t => t.id === ticketId)?.status;
    await supabase
      .from('support_tickets')
      .update({ 
        status: newStatus, 
        ...(newStatus === 'closed' ? { closed_at: new Date().toISOString() } : {}),
      } as any)
      .eq('id', ticketId);

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
    loadTickets();
    toast({ title: 'Status atualizado' });

    // Notify the client by email of the status change
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket && previousStatus !== newStatus) {
      supabase.functions.invoke('send-support-email', {
        body: {
          type: 'status_change',
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          category: ticket.category || 'support',
          previous_status: previousStatus,
          new_status: newStatus,
          created_by: ticket.created_by,
        },
      }).catch(console.error);
    }
  };

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && (t.category || 'support') !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticket_number.toString().includes(q) ||
        (accounts[t.account_id] || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const featureRequestCount = tickets.filter(t => (t.category || 'support') === 'feature_request' && ['open','in_progress'].includes(t.status)).length;

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Ticket className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{tickets.length}</p>
              <p className="text-xs text-muted-foreground">Total tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-xs text-muted-foreground">Abertos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Ticket className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{featureRequestCount}</p>
              <p className="text-xs text-muted-foreground">Ajustes técnicos pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ticket, conta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="support">Suporte</SelectItem>
            <SelectItem value="feature_request">Ajustes técnicos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 min-h-[500px]">
        {/* Ticket List */}
        <div className="space-y-2 overflow-y-auto max-h-[600px]">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground"><Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />Nenhum ticket encontrado</CardContent></Card>
          ) : (
            filtered.map(ticket => {
              const st = statusOptions.find(s => s.value === ticket.status) || statusOptions[0];
              const cat = categoryMap[ticket.category || 'support'];
              const isSelected = selectedTicket?.id === ticket.id;
              return (
                <Card 
                  key={ticket.id} 
                  className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/30'}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cat.className}`}>{cat.label}</span>
                          <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                          {ticket.priority === 'urgent' && <Badge variant="destructive" className="text-[10px]">!</Badge>}
                          {(ticket.support_unread_count ?? 0) > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-auto animate-pulse">
                              {ticket.support_unread_count} nova{(ticket.support_unread_count ?? 0) > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate mt-0.5">{ticket.subject}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {accounts[ticket.account_id] || '—'} · {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Chat Panel */}
        <Card className="flex flex-col">
          {!selectedTicket ? (
            <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20">
              <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm">Selecione um ticket para ver a conversa</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <CardTitle className="text-sm truncate">#{selectedTicket.ticket_number} — {selectedTicket.subject}</CardTitle>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${categoryMap[selectedTicket.category || 'support'].className}`}>
                        {categoryMap[selectedTicket.category || 'support'].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{accounts[selectedTicket.account_id] || '—'}</p>
                  </div>
                  <Select value={selectedTicket.status} onValueChange={v => handleStatusChange(selectedTicket.id, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                {msgLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  messages.map(msg => {
                    const isSupport = msg.sender_type === 'support';
                    return (
                      <div key={msg.id} className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isSupport 
                            ? 'bg-primary text-primary-foreground rounded-br-md' 
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                          {!isSupport && (
                            <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender_name || 'Cliente'}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.attachment_url && <AttachmentBubble url={msg.attachment_url} type={msg.attachment_type} />}
                          <p className={`text-[10px] mt-1 ${isSupport ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-3 space-y-2">
                {replyFile && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    {replyFile.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="truncate flex-1">{replyFile.name}</span>
                    <button onClick={() => setReplyFile(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => setReplyFile(e.target.files?.[0] || null)}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => replyFileInputRef.current?.click()} disabled={sending} title="Anexar arquivo">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Responder..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={handleSendMessage} disabled={sending || (!newMsg.trim() && !replyFile)} size="icon">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
