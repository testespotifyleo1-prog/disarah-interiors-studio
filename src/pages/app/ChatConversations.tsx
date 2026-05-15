import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, ToggleLeft, ToggleRight, PanelRightClose, PanelRightOpen, UserPlus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ChatConversationList, { type Conversation, formatPhone, displayName } from '@/components/chat/ChatConversationList';
import ChatMessageArea, { type ChatMessage } from '@/components/chat/ChatMessageArea';
import ChatInput from '@/components/chat/ChatInput';
import ChatCustomerPanel from '@/components/chat/ChatCustomerPanel';
import ChatSaleLinkDialog from '@/components/chat/ChatSaleLinkDialog';
import ContactAvatar from '@/components/chat/ContactAvatar';
import SaveContactDialog from '@/components/chat/SaveContactDialog';
import CreateOrderDialog from '@/components/chat/CreateOrderDialog';
import NewContactDialog from '@/components/chat/NewContactDialog';
import { useNavigate } from 'react-router-dom';
import { clearWhatsAppUnread } from '@/hooks/useWhatsAppNotifications';

interface SendOptions {
  message?: string;
  imageUrl?: string;
  audioUrl?: string;
  stickerUrl?: string;
}

export default function ChatConversations() {
  const { currentAccount, currentStore } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (currentStore) loadConversations(); }, [currentStore]);
  useEffect(() => { clearWhatsAppUnread(); }, []);

  useEffect(() => {
    if (!currentStore) return;
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        if (selectedConv) loadMessages(selectedConv.id);
        loadConversations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentStore, selectedConv]);

  const loadConversations = async () => {
    if (!currentStore) return;
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('last_message_at', { ascending: false });
    const list = (data || []) as Conversation[];
    setConversations(list);
    // Mantém typing/profile atualizado da conversa selecionada
    if (selectedConv) {
      const fresh = list.find(c => c.id === selectedConv.id);
      if (fresh) setSelectedConv(fresh);
    }
    setLoading(false);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages((data || []) as ChatMessage[]);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    loadMessages(conv.id);
    // Atualiza foto/perfil em background se nunca buscou
    if (!conv.profile_pic_url && !conv['profile_fetched_at' as keyof Conversation]) {
      supabase.functions.invoke('whatsapp-contact-info', { body: { conversation_id: conv.id } })
        .then(() => loadConversations())
        .catch(() => {});
    }
  };

  const sendMessage = async (opts: SendOptions) => {
    if (!selectedConv) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        conversation_id: selectedConv.id,
        message: opts.message,
        image_url: opts.imageUrl,
        audio_url: opts.audioUrl,
        sticker_url: opts.stickerUrl,
      },
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: error.message });
    } else {
      loadMessages(selectedConv.id);
    }
    setSending(false);
  };

  const toggleAI = async (conv: Conversation) => {
    await supabase.from('chat_conversations')
      .update({ is_ai_active: !conv.is_ai_active })
      .eq('id', conv.id);
    loadConversations();
    if (selectedConv?.id === conv.id) {
      setSelectedConv({ ...conv, is_ai_active: !conv.is_ai_active });
    }
    toast({ title: conv.is_ai_active ? 'IA desativada — Modo manual' : 'IA reativada' });
  };

  const linkSale = async (saleId: string) => {
    if (!selectedConv) return;
    await supabase.from('chat_conversations').update({ sale_id: saleId }).eq('id', selectedConv.id);
    setSelectedConv({ ...selectedConv, sale_id: saleId });
    loadConversations();
    toast({ title: 'Venda vinculada com sucesso!' });
  };

  const onContactSaved = () => {
    loadConversations();
    if (selectedConv) {
      supabase.from('chat_conversations').select('*').eq('id', selectedConv.id).single()
        .then(({ data }) => data && setSelectedConv(data as Conversation));
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    setDeleting(true);
    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', selectedConv.id);
      if (msgError) throw msgError;

      const { error: convError } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', selectedConv.id);
      if (convError) throw convError;

      toast({ title: 'Conversa excluída', description: 'Todas as mensagens foram removidas.' });
      setSelectedConv(null);
      setMessages([]);
      setConfirmDelete(false);
      loadConversations();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Conversas WhatsApp
          </h1>
          <p className="text-xs text-muted-foreground">{conversations.length} conversa(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 h-[calc(100vh-200px)]">
        <Card className="col-span-3 overflow-hidden">
          <ChatConversationList
            conversations={conversations}
            selectedId={selectedConv?.id || null}
            onSelect={selectConversation}
            onNewContact={() => setShowNewContact(true)}
          />
        </Card>

        <Card className={`${showPanel && selectedConv ? 'col-span-6' : 'col-span-9'} flex flex-col overflow-hidden transition-all`}>
          {selectedConv ? (
            <>
              <CardHeader className="p-2.5 border-b flex flex-row items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ContactAvatar
                    name={selectedConv.customer_name || selectedConv.customer_pushname}
                    phone={selectedConv.phone}
                    pictureUrl={selectedConv.profile_pic_url}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate">{displayName(selectedConv)}</CardTitle>
                    <p className="text-[10px] text-muted-foreground">{formatPhone(selectedConv.phone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!selectedConv.customer_id && (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowSaveContact(true)} title="Salvar contato">
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> Salvar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowCreateOrder(true)} title="Criar pedido">
                    <ShoppingCart className="mr-1 h-3.5 w-3.5" /> Pedido
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => toggleAI(selectedConv)}>
                    {selectedConv.is_ai_active
                      ? <><ToggleRight className="mr-1 h-3.5 w-3.5 text-green-500" /> IA</>
                      : <><ToggleLeft className="mr-1 h-3.5 w-3.5" /> IA Off</>}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)} title="Excluir conversa">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPanel(!showPanel)} title="Painel do cliente">
                    {showPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardHeader>
              <ChatMessageArea messages={messages} isTyping={!!(selectedConv as any).is_typing} />
              <ChatInput onSend={sendMessage} sending={sending} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </Card>

        {showPanel && selectedConv && (
          <Card className="col-span-3 overflow-hidden">
            <CardHeader className="p-2.5 border-b">
              <CardTitle className="text-xs">Detalhes</CardTitle>
            </CardHeader>
            <ChatCustomerPanel
              conversation={selectedConv}
              accountId={currentAccount?.id || ''}
              onLinkSale={() => setShowLinkDialog(true)}
              onCreateSale={() => setShowCreateOrder(true)}
            />
          </Card>
        )}
      </div>

      <ChatSaleLinkDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        accountId={currentAccount?.id || ''}
        storeId={currentStore?.id || ''}
        onLink={linkSale}
      />

      {selectedConv && currentAccount && (
        <SaveContactDialog
          open={showSaveContact}
          onClose={() => setShowSaveContact(false)}
          conversationId={selectedConv.id}
          accountId={currentAccount.id}
          phone={selectedConv.phone}
          initialName={selectedConv.customer_name || selectedConv.customer_pushname}
          onSaved={onContactSaved}
        />
      )}

      {selectedConv && currentStore && (
        <CreateOrderDialog
          open={showCreateOrder}
          onClose={() => setShowCreateOrder(false)}
          storeId={currentStore.id}
          conversationId={selectedConv.id}
          customerName={selectedConv.customer_name || selectedConv.customer_pushname || null}
          phone={selectedConv.phone}
          onSentLink={() => loadMessages(selectedConv.id)}
        />
      )}

      {currentAccount && currentStore && (
        <NewContactDialog
          open={showNewContact}
          onClose={() => setShowNewContact(false)}
          accountId={currentAccount.id}
          storeId={currentStore.id}
          onCreated={async (convId) => {
            await loadConversations();
            const { data } = await supabase
              .from('chat_conversations').select('*').eq('id', convId).single();
            if (data) selectConversation(data as Conversation);
          }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a conversa com{' '}
              <strong>{selectedConv ? displayName(selectedConv) : ''}</strong> e
              todas as suas mensagens. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConversation(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
