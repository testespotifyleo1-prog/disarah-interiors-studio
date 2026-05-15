import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Headset, X, Send, Loader2, Plus, ArrowLeft, Clock, Sparkles, UserRound,
  AlertCircle, CheckCircle2, MessageSquare, Paperclip, FileText, ImageIcon
} from 'lucide-react';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportTicket {
  id: string;
  ticket_number: number;
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
  support: { label: 'Suporte', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  feature_request: { label: 'Ajuste técnico', className: 'bg-primary/10 text-primary border-primary/20' },
};

interface SupportMessage {
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
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5 rounded-lg overflow-hidden border border-border/50 max-w-[220px]">
        <img src={url} alt="anexo" className="w-full h-auto object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px] hover:bg-background/70 transition-colors">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">Abrir anexo</span>
    </a>
  );
}

const statusMap: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberto', color: 'text-destructive' },
  in_progress: { label: 'Em Andamento', color: 'text-primary' },
  resolved: { label: 'Resolvido', color: 'text-muted-foreground' },
  closed: { label: 'Fechado', color: 'text-muted-foreground' },
};

type View = 'ai' | 'list' | 'chat' | 'new';

export function SupportChatWidget() {
  const { user, currentAccount, isOwnerOrAdmin } = useAuth();
  const { plan, isLegacyAccount } = usePlan();
  const { toast } = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('ai');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newCategory, setNewCategory] = useState<'support' | 'feature_request'>('support');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  // IA state
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);

  const uploadAttachment = async (file: File): Promise<{ url: string | null; type: string }> => {
    if (!currentAccount) return { url: null, type: file.type };
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${currentAccount.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
    if (open && currentAccount) {
      loadTickets();
    }
  }, [open, currentAccount?.id]);

  // Count unread messages from support across all tickets for the floating badge
  useEffect(() => {
    if (!currentAccount) return;
    const loadCount = async () => {
      const { data } = await supabase
        .from('support_tickets')
        .select('client_unread_count')
        .eq('account_id', currentAccount.id);
      const total = (data || []).reduce((acc: number, t: any) => acc + (t.client_unread_count || 0), 0);
      setUnreadCount(total);
    };
    loadCount();

    const channel = supabase
      .channel('support-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => loadCount())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => loadCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentAccount?.id]);

  // Realtime messages
  useEffect(() => {
    if (selectedTicket && view === 'chat') {
      loadMessages(selectedTicket.id);

      const channel = supabase
        .channel(`widget-msgs-${selectedTicket.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as SupportMessage]);
          setTimeout(scrollToBottom, 100);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedTicket?.id, view]);

  useEffect(scrollToBottom, [messages]);

  // Listen for external "open support with prefill" events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const subject = (detail.subject as string) || '';
      const content = (detail.content as string) || '';
      const priority = (detail.priority as string) || 'normal';
      const category = (detail.category as 'support' | 'feature_request') || 'support';
      setNewSubject(subject);
      setNewContent(content);
      setNewPriority(priority);
      setNewCategory(category);
      setBubbleDismissed(true);
      setOpen(true);
      setView('new');
    };
    window.addEventListener('typos:open-support', handler as EventListener);
    return () => window.removeEventListener('typos:open-support', handler as EventListener);
  }, []);

  // Listen for "open ticket by id" events from the notification bell
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const ticketId = detail.ticketId as string;
      if (!ticketId || !currentAccount) return;
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();
      if (data) {
        setBubbleDismissed(true);
        setOpen(true);
        setSelectedTicket(data as any);
        setView('chat');
      }
    };
    window.addEventListener('open-support-ticket', handler as EventListener);
    return () => window.removeEventListener('open-support-ticket', handler as EventListener);
  }, [currentAccount?.id]);

  // Hide on PDV Rápido or if not owner/admin
  const isPdvRapido = location.pathname === '/app/pdv-rapido';
  if (!isOwnerOrAdmin || !currentAccount || isPdvRapido) return null;

  const loadTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('account_id', currentAccount!.id)
      .order('created_at', { ascending: false });
    setTickets((data as any[]) || []);
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
    // Mark as read for the client side
    supabase.rpc('mark_support_ticket_read' as any, { _ticket_id: ticketId }).then(() => {});
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setView('chat');
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newContent.trim() || !currentAccount || !user) return;
    setCreating(true);

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        account_id: currentAccount.id,
        created_by: user.id,
        subject: newSubject.trim(),
        priority: newPriority,
        category: newCategory,
      } as any)
      .select()
      .single();

    if (error || !ticket) {
      toast({ variant: 'destructive', title: 'Erro', description: error?.message });
      setCreating(false);
      return;
    }

    let attachment_url: string | null = null;
    let attachment_type: string | null = null;
    if (newFile) {
      const up = await uploadAttachment(newFile);
      attachment_url = up.url;
      attachment_type = up.type;
    }

    await supabase.from('support_messages').insert({
      ticket_id: (ticket as any).id,
      sender_id: user.id,
      sender_name: user.user_metadata?.full_name || user.email,
      sender_type: 'client',
      content: newContent.trim(),
      attachment_url,
      attachment_type,
    } as any);

    setNewSubject('');
    setNewContent('');
    setNewPriority('normal');
    const createdCategory = newCategory;
    setNewCategory('support');
    setNewFile(null);
    setCreating(false);
    toast({ title: `Ticket #${(ticket as any).ticket_number} criado!` });
    
    // Send email notification (fire and forget)
    supabase.functions.invoke('send-support-email', {
      body: {
        type: 'new_ticket',
        ticket_id: (ticket as any).id,
        ticket_number: (ticket as any).ticket_number,
        subject: newSubject.trim(),
        priority: newPriority,
        category: createdCategory,
        message: newContent.trim(),
        sender_name: user.user_metadata?.full_name || user.email,
        created_by: user.id,
      },
    }).catch(console.error);

    // Evaluate action rules (fire and forget)
    supabase.functions.invoke('evaluate-support-action-rules', {
      body: { ticket_id: (ticket as any).id },
    }).catch(console.error);

    // Go to chat
    setSelectedTicket(ticket as any);
    setView('chat');
    loadTickets();
  };

  const handleSendMessage = async () => {
    if ((!newMsg.trim() && !chatFile) || !selectedTicket || !user) return;
    setSending(true);

    let attachment_url: string | null = null;
    let attachment_type: string | null = null;
    if (chatFile) {
      const up = await uploadAttachment(chatFile);
      attachment_url = up.url;
      attachment_type = up.type;
    }

    await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_name: user.user_metadata?.full_name || user.email,
      sender_type: 'client',
      content: newMsg.trim() || (chatFile ? '📎 Anexo enviado' : ''),
      attachment_url,
      attachment_type,
    } as any);

    await supabase
      .from('support_tickets')
      .update({ last_message_at: new Date().toISOString() } as any)
      .eq('id', selectedTicket.id);

    // Send email notification (fire and forget)
    supabase.functions.invoke('send-support-email', {
      body: {
        type: 'new_message',
        ticket_id: selectedTicket.id,
        ticket_number: selectedTicket.ticket_number,
        subject: selectedTicket.subject,
        message: newMsg.trim() || '📎 Anexo enviado',
        sender_name: user.user_metadata?.full_name || user.email,
        sender_type: 'client',
        created_by: user.id,
      },
    }).catch(console.error);

    // Evaluate action rules (fire and forget)
    supabase.functions.invoke('evaluate-support-action-rules', {
      body: { ticket_id: selectedTicket.id },
    }).catch(console.error);

    setNewMsg('');
    setChatFile(null);
    setSending(false);
  };

  const goBack = () => {
    if (view === 'chat') {
      setView('list');
      setSelectedTicket(null);
      loadTickets();
    } else {
      setView('ai');
    }
  };

  // === IA ===
  const sendToAi = async (text: string) => {
    if (!text.trim() || aiThinking) return;
    const userMsg: AiMessage = { role: 'user', content: text.trim() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiThinking(true);
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const { data, error } = await supabase.functions.invoke('support-ai-assist', {
        body: {
          message: text.trim(),
          history: aiMessages.slice(-8),
          plan_name: plan?.name,
          plan_features: (plan?.features as string[]) || [],
          is_legacy: isLegacyAccount,
        },
      });

      if (error) throw error;
      const reply = (data?.reply as string) || '';
      const shouldEscalate = data?.shouldEscalate;

      if (shouldEscalate) {
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Essa demanda precisa de um atendente humano. Vou abrir um chamado para o time Typos! agora — clique abaixo. 👇'
        }]);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (e: any) {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: e?.message?.includes('429') 
          ? '⏱️ Muitas mensagens. Aguarde um momento ou fale com um atendente.'
          : '⚠️ Não consegui responder agora. Clique em **Falar com atendente Typos!** abaixo.'
      }]);
    } finally {
      setAiThinking(false);
      setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const escalateToHuman = () => {
    // Pré-preenche o ticket com o resumo da conversa IA
    const lastUserMsg = [...aiMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setNewSubject(lastUserMsg.content.slice(0, 80));
      const transcript = aiMessages
        .map(m => `${m.role === 'user' ? '👤 Eu' : '🤖 IA'}: ${m.content}`)
        .join('\n\n');
      setNewContent(`${lastUserMsg.content}\n\n---\n📋 Histórico com a IA:\n${transcript}`);
    }
    setView('new');
  };


  return (
    <>
      {/* Thought bubble */}
      {!open && !bubbleDismissed && (
        <div className="fixed bottom-[5.5rem] right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg max-w-[220px]">
            <button 
              onClick={(e) => { e.stopPropagation(); setBubbleDismissed(true); }} 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
            <p className="text-xs font-medium text-foreground leading-snug">Precisa de ajuda? Fale com a <strong className="text-primary">IA Typos!</strong> 🤖</p>
            {/* Tail */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-card border-r border-b border-border rotate-45 rounded-br-sm" />
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="Suporte"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <Headset className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            {view !== 'ai' && (
              <button onClick={goBack} className="text-primary-foreground/80 hover:text-primary-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {view === 'ai'
              ? <Sparkles className="h-5 w-5 text-primary-foreground" />
              : <Headset className="h-5 w-5 text-primary-foreground" />}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-primary-foreground">
                {view === 'ai' ? 'IA Typos!' :
                 view === 'list' ? 'Meus Chamados' :
                 view === 'new' ? 'Falar com Atendente' : `#${selectedTicket?.ticket_number}`}
              </h3>
              {view === 'ai' && (
                <p className="text-[11px] text-primary-foreground/70">Tire suas dúvidas em segundos</p>
              )}
              {view === 'list' && (
                <p className="text-[11px] text-primary-foreground/70">Histórico de atendimentos</p>
              )}
              {view === 'chat' && selectedTicket && (
                <p className="text-[11px] text-primary-foreground/70 truncate">{selectedTicket.subject}</p>
              )}
            </div>
            {view === 'ai' && tickets.length > 0 && (
              <button
                onClick={() => setView('list')}
                className="text-primary-foreground/80 hover:text-primary-foreground text-[11px] underline-offset-2 hover:underline"
                title="Meus chamados"
              >
                Chamados
              </button>
            )}
            <button onClick={() => setOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* === IA View === */}
          {view === 'ai' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 max-h-[360px] bg-gradient-to-b from-muted/20 to-transparent">
                {aiMessages.length === 0 && (
                  <div className="text-center py-4 px-2 space-y-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Olá! Sou a IA Typos! 👋</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Me conte rapidamente o que você precisa fazer no sistema.<br />Respondo na hora.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pt-1 max-w-[280px] mx-auto">
                      {[
                        'Como cadastro um produto?',
                        'Como faço uma venda no PDV?',
                        'Como abro o caixa?',
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => sendToAi(s)}
                          className="text-[11px] text-left px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground"
                        >
                          💡 {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}>
                      {m.role === 'assistant' && (
                        <p className="text-[10px] font-semibold mb-0.5 opacity-70 flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" /> IA Typos!
                        </p>
                      )}
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}

                {aiThinking && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>

              {/* Escalate button — sempre visível */}
              <div className="border-t border-border px-3 py-2 bg-muted/30">
                <Button
                  onClick={escalateToHuman}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 h-8 text-xs border-primary/30 hover:bg-primary/5 hover:border-primary"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  Falar com atendente Typos!
                </Button>
              </div>

              {/* Input */}
              <div className="border-t border-border p-2.5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Pergunte algo sobre o sistema..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendToAi(aiInput)}
                    disabled={aiThinking}
                    className="text-sm"
                  />
                  <Button onClick={() => sendToAi(aiInput)} disabled={aiThinking || !aiInput.trim()} size="icon" className="shrink-0">
                    {aiThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}


          {/* Content */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              {/* New ticket button */}
              <div className="p-3 border-b border-border">
                <Button onClick={() => setView('new')} className="w-full gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Novo Chamado
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground px-4 text-center">
                  <MessageSquare className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">Nenhum chamado aberto</p>
                  <p className="text-xs mt-1">Clique acima para falar com o suporte.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tickets.map(ticket => {
                    const st = statusMap[ticket.status] || statusMap.open;
                    const cat = categoryMap[ticket.category || 'support'];
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openTicket(ticket)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${cat.className}`}>{cat.label}</span>
                          <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                          {ticket.priority === 'urgent' && (
                            <span className="text-[10px] font-bold text-destructive">⚡</span>
                          )}
                          {(ticket.client_unread_count ?? 0) > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse">
                              {ticket.client_unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">{ticket.subject}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === 'new' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de chamado</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory('support')}
                    className={`text-left rounded-lg border px-2.5 py-2 transition-all ${
                      newCategory === 'support'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="text-[11px] font-semibold">Suporte</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Dúvida, erro, ajuda no uso</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory('feature_request')}
                    className={`text-left rounded-lg border px-2.5 py-2 transition-all ${
                      newCategory === 'feature_request'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="text-[11px] font-semibold">Ajuste técnico</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Novo módulo, feature ou personalização</p>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assunto</Label>
                <Input
                  placeholder={newCategory === 'feature_request' ? 'Ex: Adicionar campo de cor no produto' : 'Ex: Dúvida sobre emissão fiscal'}
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  placeholder={newCategory === 'feature_request'
                    ? 'Descreva o ajuste, módulo ou feature que precisa, e como sua empresa trabalha hoje...'
                    : 'Descreva sua dúvida ou problema...'}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anexo (opcional)</Label>
                <input
                  ref={newFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => setNewFile(e.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => newFileInputRef.current?.click()} className="w-full gap-2 justify-start">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="truncate text-xs">{newFile ? newFile.name : 'Anexar imagem ou PDF'}</span>
                </Button>
              </div>
              <Button
                onClick={handleCreateTicket}
                disabled={creating || !newSubject.trim() || !newContent.trim()}
                className="w-full gap-2"
                size="sm"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          )}

          {view === 'chat' && selectedTicket && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 max-h-[340px]">
                {msgLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-10">Aguardando resposta...</p>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_type === 'client';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                        }`}>
                          {!isMe && (
                            <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                              {msg.sender_name || 'Suporte Typos'}
                            </p>
                          )}
                          <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          {msg.attachment_url && <AttachmentBubble url={msg.attachment_url} type={msg.attachment_type} />}
                          <p className={`text-[9px] mt-1 ${isMe ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                <div className="border-t border-border p-2.5 space-y-1.5">
                  {chatFile && (
                    <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px]">
                      {chatFile.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate flex-1">{chatFile.name}</span>
                      <button onClick={() => setChatFile(null)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={chatFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => setChatFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={sending}
                      className="shrink-0 h-9 w-9"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      disabled={sending}
                      className="text-sm"
                    />
                    <Button onClick={handleSendMessage} disabled={sending || (!newMsg.trim() && !chatFile)} size="icon" className="shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                <div className="border-t border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Este chamado foi {selectedTicket.status === 'resolved' ? 'resolvido' : 'fechado'}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
