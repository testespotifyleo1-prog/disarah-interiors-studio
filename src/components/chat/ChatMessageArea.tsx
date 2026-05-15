import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Mic, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  direction: string;
  content: string;
  message_type: string;
  is_ai_generated: boolean;
  created_at: string;
  media_url?: string | null;
  status?: string | null;
}

interface Props {
  messages: ChatMessage[];
  isTyping?: boolean;
}

export default function ChatMessageArea({ messages, isTyping }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const renderTicks = (msg: ChatMessage) => {
    if (msg.direction !== 'outbound') return null;
    const status = msg.status || 'sent';
    if (status === 'read') {
      return <CheckCheck className="h-3 w-3 text-sky-500" />;
    }
    if (status === 'delivered' || status === 'received') {
      return <CheckCheck className="h-3 w-3 opacity-60" />;
    }
    return <Check className="h-3 w-3 opacity-60" />;
  };

  const renderMedia = (msg: ChatMessage) => {
    if (!msg.media_url) return null;

    if (msg.message_type === 'image') {
      return (
        <div className="mt-1 rounded overflow-hidden max-w-[240px]">
          <img
            src={msg.media_url}
            alt="Imagem"
            className="w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
        </div>
      );
    }

    if (msg.message_type === 'sticker') {
      return (
        <div className="mt-1">
          <img src={msg.media_url} alt="Sticker" className="w-32 h-32 object-contain" />
        </div>
      );
    }

    if (msg.message_type === 'audio' || msg.message_type === 'ptt') {
      return (
        <div className="mt-1 flex items-center gap-2 p-1.5 bg-background/50 rounded-lg">
          <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
          <audio controls className="h-8 max-w-[220px]" preload="metadata">
            <source src={msg.media_url} />
          </audio>
        </div>
      );
    }

    if (msg.message_type === 'video') {
      return (
        <div className="mt-1 rounded overflow-hidden max-w-[240px]">
          <video controls className="w-full h-auto rounded">
            <source src={msg.media_url} />
          </video>
        </div>
      );
    }

    return (
      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs underline flex items-center gap-1">
        📎 Ver arquivo
      </a>
    );
  };

  return (
    <ScrollArea className="flex-1 wa-chat-bg">
      <div className="space-y-2 p-4">
        {messages.map(msg => {
          const isSticker = msg.message_type === 'sticker';
          const isOutbound = msg.direction === 'outbound';
          const bubble = isSticker
            ? 'bg-transparent shadow-none'
            : isOutbound
              ? msg.is_ai_generated
                ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground dark:text-white rounded-br-sm'
                : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground dark:text-white rounded-br-sm'
              : 'bg-white dark:bg-[#202c33] text-foreground dark:text-white rounded-bl-sm';
          return (
            <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm ${bubble}`}>
                {msg.is_ai_generated && !isSticker && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <Bot className="h-3 w-3" />
                    <span className="text-[10px] font-semibold opacity-70">IA</span>
                  </div>
                )}
                {!isSticker && msg.content && msg.content !== '📷 Imagem enviada' && msg.content !== '📷 Imagem' && msg.content !== '🎙️ Áudio' && (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
                {renderMedia(msg)}
                {!isSticker && (
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] opacity-60">
                      {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                    </span>
                    {renderTicks(msg)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#202c33] text-muted-foreground rounded-lg rounded-bl-sm px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="wa-typing-dot" />
                <span className="wa-typing-dot" />
                <span className="wa-typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
