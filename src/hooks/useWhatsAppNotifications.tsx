import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';

/**
 * Conta de mensagens não lidas (inbound) por loja, persistida em memória.
 * Outros componentes podem assinar via window event 'wa-unread-changed'.
 */
const state = {
  unread: 0,
};

export function getWhatsAppUnread() {
  return state.unread;
}

function emitChange() {
  window.dispatchEvent(new CustomEvent('wa-unread-changed', { detail: state.unread }));
}

export function clearWhatsAppUnread() {
  if (state.unread === 0) return;
  state.unread = 0;
  emitChange();
}

function incUnread() {
  state.unread += 1;
  emitChange();
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.15);
  } catch {}
}

/**
 * Hook montado uma única vez no AppLayout. Assina inserts em chat_messages
 * filtrando pelo store_id atual e dispara toast + bipe + atualiza contador.
 */
export function useWhatsAppNotifications() {
  const { currentStore } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  useEffect(() => {
    if (!currentStore?.id) return;

    // Reset contador ao trocar de loja
    state.unread = 0;
    emitChange();

    const channel = supabase
      .channel(`wa-notify-${currentStore.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg: any = payload.new;
          if (!msg || msg.direction !== 'inbound') return;

          // Confirma que a conversa pertence à loja atual
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('store_id, customer_name, customer_pushname, phone')
            .eq('id', msg.conversation_id)
            .single();

          if (!conv || conv.store_id !== currentStore.id) return;

          const name =
            conv.customer_name ||
            conv.customer_pushname ||
            conv.phone ||
            'Contato';

          // Se já estiver na tela de conversas, não conta como não lida
          const onChat = locationRef.current.startsWith('/app/chat');
          if (!onChat) {
            incUnread();
          }

          beep();
          const preview =
            (msg.body && String(msg.body).slice(0, 80)) ||
            (msg.media_url ? '📎 Mídia recebida' : 'Nova mensagem');

          toast(`💬 ${name}`, {
            description: preview,
            duration: 6000,
            icon: <MessageCircle className="h-4 w-4 text-green-600" />,
            action: onChat
              ? undefined
              : {
                  label: 'Abrir',
                  onClick: () => navigate('/app/chat'),
                },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStore?.id, navigate]);
}

/** Hook auxiliar para componentes lerem o contador reativo. */
export function useWhatsAppUnreadCount() {
  const [count, setCount] = useState(state.unread);
  useEffect(() => {
    const handler = (e: Event) => setCount((e as CustomEvent).detail ?? 0);
    window.addEventListener('wa-unread-changed', handler);
    return () => window.removeEventListener('wa-unread-changed', handler);
  }, []);
  return count;
}
