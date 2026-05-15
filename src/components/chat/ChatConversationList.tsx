import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Bot, Search, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import ContactAvatar from './ContactAvatar';

export interface Conversation {
  id: string;
  phone: string;
  customer_name: string | null;
  customer_id: string | null;
  customer_pushname?: string | null;
  profile_pic_url?: string | null;
  status: string;
  is_ai_active: boolean;
  is_typing?: boolean;
  typing_at?: string | null;
  last_message_at: string;
  created_at: string;
  sale_id: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onNewContact?: () => void;
}

export function formatPhone(p: string) {
  if (p.length === 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  return p;
}

export function displayName(c: Pick<Conversation, 'customer_name' | 'customer_pushname' | 'phone'>) {
  return c.customer_name || c.customer_pushname || formatPhone(c.phone);
}

export default function ChatConversationList({ conversations, selectedId, onSelect, onNewContact }: Props) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      c.customer_name?.toLowerCase().includes(term) ||
      c.customer_pushname?.toLowerCase().includes(term) ||
      c.phone.includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-[#111b21]">
      <div className="p-2 border-b border-border/50 space-y-2 bg-[#f0f2f5] dark:bg-[#111b21]">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          {onNewContact && (
            <Button size="sm" className="h-8 px-2" onClick={onNewContact} title="Novo contato">
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
            </p>
          ) : filtered.map(conv => (
            <div
              key={conv.id}
              className={`p-2 rounded-md cursor-pointer transition-colors flex items-center gap-2 ${
                selectedId === conv.id
                  ? 'bg-[#e9edef] dark:bg-[#2a3942]'
                  : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
              }`}
              onClick={() => onSelect(conv)}
            >
              <ContactAvatar
                name={conv.customer_name || conv.customer_pushname}
                phone={conv.phone}
                pictureUrl={conv.profile_pic_url}
                className="h-9 w-9 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{displayName(conv)}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {conv.is_ai_active && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-300">
                        <Bot className="h-2.5 w-2.5 mr-0.5" /> IA
                      </Badge>
                    )}
                    {conv.sale_id && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-300">
                        💰
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {(conv.customer_name || conv.customer_pushname) ? formatPhone(conv.phone) + ' · ' : ''}
                  {format(new Date(conv.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
