import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Send, Image as ImageIcon, Smile } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import AudioRecorder from './AudioRecorder';

interface SendOptions {
  message?: string;
  imageUrl?: string;
  audioUrl?: string;
  stickerUrl?: string;
}

interface Props {
  onSend: (opts: SendOptions) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
}

const QUICK_REPLIES = [
  '👋 Olá! Como posso ajudar?',
  '✅ Pedido confirmado! Obrigado pela preferência.',
  '📦 Seu pedido está sendo preparado.',
  '🚚 Saiu para entrega!',
  '💰 Segue o link para pagamento:',
  '⏰ Retornaremos em breve com mais informações.',
  '😊 Posso ajudar com mais alguma coisa?',
];

export default function ChatInput({ onSend, sending, disabled }: Props) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendText = async () => {
    if (!text.trim() || disabled) return;
    const t = text.trim();
    setText('');
    await onSend({ message: t });
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Imagem muito grande', description: 'Máximo 16MB.' });
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `images/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      await onSend({ imageUrl: data.publicUrl, message: text.trim() || undefined });
      setText('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha ao enviar imagem', description: e.message });
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAudioRecorded = async (blob: Blob, _dur: number) => {
    setUploadingAudio(true);
    try {
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('webm') ? 'webm' : 'mp3';
      const path = `audio/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, blob, { contentType: blob.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      await onSend({ audioUrl: data.publicUrl });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha ao enviar áudio', description: e.message });
    } finally {
      setUploadingAudio(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="border-t bg-background">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
      />
      <div className="p-2 flex items-end gap-1.5">
        {/* Quick replies */}
        <Popover open={showQuick} onOpenChange={setShowQuick}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Respostas rápidas">
              <span className="text-base">⚡</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1" align="start">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Respostas rápidas</p>
            {QUICK_REPLIES.map((r, i) => (
              <button
                key={i}
                onClick={() => { setText(r); setShowQuick(false); inputRef.current?.focus(); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
              >{r}</button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Emoji */}
        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Emoji">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="start" side="top">
            <EmojiPicker
              onEmojiClick={(d) => insertEmoji(d.emoji)}
              emojiStyle={EmojiStyle.NATIVE}
              theme={Theme.AUTO}
              width={320}
              height={380}
              searchPlaceholder="Buscar emoji..."
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
            />
          </PopoverContent>
        </Popover>

        {/* Image upload */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingImage}
          title="Enviar imagem"
        >
          {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Button>

        {/* Text input */}
        <Input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={uploadingAudio ? 'Enviando áudio…' : 'Digite sua mensagem...'}
          className="h-9 flex-1"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendText()}
          disabled={disabled || uploadingAudio}
        />

        {/* Mic OR Send */}
        {text.trim() ? (
          <Button
            onClick={handleSendText}
            disabled={sending || !text.trim() || disabled}
            size="icon"
            className="h-9 w-9 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        ) : (
          <AudioRecorder onRecorded={handleAudioRecorded} disabled={disabled || uploadingAudio} />
        )}
      </div>
    </div>
  );
}
