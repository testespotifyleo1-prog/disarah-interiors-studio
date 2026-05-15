import { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onRecorded: (blob: Blob, durationSec: number) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onRecorded, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => stopTimer(), []);

  const stopTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = async (e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled) return;
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      // Prefer ogg/opus (compatível com WhatsApp PTT). Fallback webm/opus.
      const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/ogg' });
        const dur = Math.round((Date.now() - startedAtRef.current) / 1000);
        if (blob.size > 500 && dur >= 1) onRecorded(blob, dur);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const stop = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!recording) return;
    stopTimer();
    setRecording(false);
    recorderRef.current?.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    stopTimer();
    setRecording(false);
    recorderRef.current?.stop();
  };

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <div className="flex items-center gap-2 text-xs text-red-600 font-medium animate-pulse">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          <button onClick={cancel} className="text-muted-foreground hover:text-destructive text-[10px] underline">cancelar</button>
        </div>
      )}
      <Button
        type="button"
        variant={recording ? 'destructive' : 'ghost'}
        size="icon"
        className={cn('h-8 w-8 shrink-0 select-none touch-none', recording && 'animate-pulse')}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={cancel}
        disabled={disabled}
        title="Segure para gravar áudio"
      >
        {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    </div>
  );
}
