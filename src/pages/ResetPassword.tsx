import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { z } from 'zod';

const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');

function FloatingInput({
  id, label, type = 'text', icon: Icon, value, onChange, required,
}: {
  id: string; label: string; type?: string; icon: React.ElementType;
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = focused || value.length > 0;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 transition-all duration-300 cursor-text',
        focused ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]' : 'border-border hover:border-primary/40',
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <Icon className={cn('h-5 w-5 shrink-0 transition-colors duration-300', focused ? 'text-primary' : 'text-muted-foreground')} />
      <div className="relative flex-1 min-h-[28px]">
        <label htmlFor={id} className={cn(
          'pointer-events-none absolute left-0 origin-left transition-all duration-300 font-medium',
          active ? '-top-2.5 text-[10px] text-primary' : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground',
        )}>{label}</label>
        <input
          ref={inputRef} id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          required={required}
          className="w-full bg-transparent pt-1 text-sm text-foreground outline-none placeholder:text-transparent"
        />
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
      setIsRecovery(true);
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { passwordSchema.parse(password); } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ variant: 'destructive', title: 'Erro', description: err.errors[0].message });
        return;
      }
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As senhas não coincidem' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      setSuccess(true);
      toast({ title: 'Senha alterada!', description: 'Sua senha foi atualizada com sucesso.' });
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="hidden lg:block lg:w-[55%] xl:w-[58%] p-3">
        <AuthBrandPanel />
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center lg:items-start gap-1">
            <TyposLogo size="md" showCredit />
            <p className="text-sm text-muted-foreground">Redefinir senha</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-lg font-semibold text-foreground">Senha alterada com sucesso!</p>
              <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <FloatingInput id="new-password" label="Nova senha" type="password" icon={Lock} value={password} onChange={setPassword} required />
              <FloatingInput id="confirm-password" label="Confirmar nova senha" type="password" icon={Lock} value={confirmPassword} onChange={setConfirmPassword} required />
              <Button
                type="submit" disabled={loading}
                className={cn(
                  'group relative h-12 w-full overflow-hidden rounded-2xl text-base font-semibold tracking-wide',
                  'bg-primary text-primary-foreground',
                  'shadow-[0_4px_20px_hsl(var(--primary)/0.35)]',
                  'hover:shadow-[0_6px_28px_hsl(var(--primary)/0.5)]',
                  'active:scale-[0.98] transition-all duration-300',
                )}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Redefinir senha <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></>)}
                </span>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
