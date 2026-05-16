import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowRight, Phone, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { z } from 'zod';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter ao menos 1 letra maiúscula')
  .regex(/[0-9]/, 'Senha deve ter ao menos 1 número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve ter ao menos 1 caractere especial');
const loginPasswordSchema = z.string().min(1, 'Informe a senha');
const nameSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');
const phoneSchema = z.string().regex(/^\d{10,11}$/, 'Telefone inválido (DDD + número)');
const AUTH_FLOW_STORAGE_KEY = 'typos-auth-flow';

function formatPhoneBR(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* ── Floating-label input with icon ── */
function FloatingInput({
  id, label, type = 'text', icon: Icon, value, onChange, required,
}: {
  id: string; label: string; type?: string; icon: React.ElementType;
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = focused || value.length > 0;
  const isPassword = type === 'password';
  const effectiveType = isPassword && reveal ? 'text' : type;

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
          ref={inputRef} id={id} type={effectiveType} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          required={required}
          className={cn(
            'w-full bg-transparent pt-1 text-sm text-foreground outline-none placeholder:text-transparent',
            isPassword && 'pr-8',
          )}
        />
      </div>
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); setReveal(r => !r); }}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 -mr-1"
          aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function OtpCodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-3">
      <label htmlFor="otp-code" className="block text-center text-sm text-muted-foreground">
        Digite o código de 6 dígitos
      </label>
      <input
        id="otp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="h-16 w-full rounded-2xl border-2 border-border bg-card px-4 text-center text-3xl font-semibold tracking-[0.45em] text-foreground outline-none transition-all duration-300 placeholder:tracking-[0.45em] placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
      />
      <p className="text-center text-xs text-muted-foreground">
        Se a tela atualizar, o passo da recuperação continua salvo.
      </p>
    </div>
  );
}

/* ── Animated submit button ── */
function SubmitButton({ loading, children, onClick, disabled }: { loading: boolean; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      type={onClick ? 'button' : 'submit'} disabled={loading || disabled} onClick={onClick}
      className={cn(
        'group relative h-12 w-full overflow-hidden rounded-2xl text-base font-semibold tracking-wide',
        'bg-primary text-primary-foreground',
        'shadow-[0_4px_20px_hsl(var(--primary)/0.35)]',
        'hover:shadow-[0_6px_28px_hsl(var(--primary)/0.5)]',
        'active:scale-[0.98] transition-all duration-300',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:shadow-none',
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />
      <span className="relative flex items-center justify-center gap-2">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>{children}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></>)}
      </span>
    </Button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/app/dashboard';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRestoredFlow, setHasRestoredFlow] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  // OTP verification state
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpType, setOtpType] = useState<'signup' | 'recovery'>('signup');

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Reset password state (after OTP verified)
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    try {
      const savedFlow = sessionStorage.getItem(AUTH_FLOW_STORAGE_KEY);
      if (!savedFlow) {
        setHasRestoredFlow(true);
        return;
      }

      const parsed = JSON.parse(savedFlow) as {
        forgotEmail?: string;
        otpCode?: string;
        otpEmail?: string;
        otpType?: 'signup' | 'recovery';
        showForgot?: boolean;
        showNewPassword?: boolean;
        showOtpVerify?: boolean;
      };

      setForgotEmail(parsed.forgotEmail ?? '');
      setOtpCode(parsed.otpCode ?? '');
      setOtpEmail(parsed.otpEmail ?? '');
      setOtpType(parsed.otpType === 'recovery' ? 'recovery' : 'signup');
      setShowForgot(Boolean(parsed.showForgot));
      setShowNewPassword(Boolean(parsed.showNewPassword));
      setShowOtpVerify(Boolean(parsed.showOtpVerify));
    } catch (error) {
      console.error('Erro ao restaurar fluxo de autenticação:', error);
      sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
    } finally {
      setHasRestoredFlow(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredFlow) return;

    const hasPendingFlow = showForgot || showOtpVerify || showNewPassword;
    if (!hasPendingFlow) {
      sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify({
      forgotEmail,
      otpCode,
      otpEmail,
      otpType,
      showForgot,
      showNewPassword,
      showOtpVerify,
    }));
  }, [forgotEmail, hasRestoredFlow, otpCode, otpEmail, otpType, showForgot, showNewPassword, showOtpVerify]);

  if (loading || !hasRestoredFlow) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      loginPasswordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: 'destructive', title: 'Erro de validação', description: error.errors[0].message });
        return;
      }
    }
    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);
    if (error) {
      toast({
        variant: 'destructive', title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message,
      });
    } else {
      sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
      navigate(redirectTo, { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = signupPhone.replace(/\D/g, '');
    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      phoneSchema.parse(phoneDigits);
      passwordSchema.parse(signupPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: 'destructive', title: 'Erro de validação', description: error.errors[0].message });
        return;
      }
    }
    if (signupPassword !== signupPasswordConfirm) {
      toast({ variant: 'destructive', title: 'Senhas não conferem', description: 'A confirmação deve ser igual à senha.' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, phoneDigits);
    setIsSubmitting(false);
    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) message = 'Este email já está cadastrado';
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: message });
      return;
    }

    try {
      await supabase.functions.invoke('send-auth-email', {
        body: { email: signupEmail, type: 'signup' },
      });
      setOtpEmail(signupEmail);
      setOtpCode('');
      setOtpType('signup');
      setShowNewPassword(false);
      setShowOtpVerify(true);
      toast({ title: 'Cadastro realizado!', description: 'Verifique seu email e insira o código de verificação.' });
    } catch {
      toast({ title: 'Cadastro realizado!', description: 'Houve um erro ao enviar o código. Tente fazer login.' });
    }
  };

  const handleForgotPassword = async () => {
    try { emailSchema.parse(forgotEmail); } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ variant: 'destructive', title: 'Erro', description: err.errors[0].message });
        return;
      }
    }
    setIsSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke('send-auth-email', {
        body: { email: forgotEmail, type: 'recovery' },
      });
      if (error) throw error;
      setOtpEmail(forgotEmail);
      setOtpCode('');
      setOtpType('recovery');
      setShowNewPassword(false);
      setShowOtpVerify(true);
      setShowForgot(false);
      toast({ title: 'Código enviado!', description: 'Verifique sua caixa de entrada.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao enviar código. Tente novamente.' });
    }
    setIsSendingReset(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Insira o código completo de 6 dígitos.' });
      return;
    }

    setIsSubmitting(true);

    if (otpType === 'signup') {
      const { data, error } = await supabase.functions.invoke('verify-auth-code', {
        body: { email: otpEmail, code: otpCode, type: 'signup' },
      });
      setIsSubmitting(false);
      if (error || data?.error) {
        toast({ variant: 'destructive', title: 'Erro', description: data?.error || 'Código inválido ou expirado.' });
        return;
      }
      sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
      toast({ title: 'Email verificado! ✅', description: 'Sua conta foi ativada. Faça login para continuar.' });
      setShowOtpVerify(false);
      setOtpCode('');
    } else {
      setShowNewPassword(true);
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    try { passwordSchema.parse(newPassword); } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ variant: 'destructive', title: 'Erro', description: err.errors[0].message });
        return;
      }
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'As senhas não coincidem.' });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.functions.invoke('verify-auth-code', {
      body: { email: otpEmail, code: otpCode, type: 'recovery', newPassword },
    });
    setIsSubmitting(false);

    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Erro', description: data?.error || 'Falha ao redefinir senha.' });
      return;
    }

    sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
    toast({ title: 'Senha alterada! ✅', description: 'Faça login com sua nova senha.' });
    setShowForgot(false);
    setShowOtpVerify(false);
    setShowNewPassword(false);
    setForgotEmail('');
    setOtpEmail('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleBackFromOtp = () => {
    setShowOtpVerify(false);
    setShowNewPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');

    if (otpType === 'recovery') {
      setShowForgot(true);
      setForgotEmail(otpEmail);
    }
  };

  // ── OTP Verification Screen ──
  if (showOtpVerify) {
    return (
      <div className="fixed inset-0 flex bg-background">
        <div className="hidden lg:block lg:w-[55%] xl:w-[58%] p-3"><AuthBrandPanel /></div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8">
            <div className="flex flex-col items-center lg:items-start gap-1">
              <TyposLogo size="md" showCredit />
              <p className="text-sm text-muted-foreground">
                {showNewPassword ? 'Nova senha' : 'Verificação por código'}
              </p>
            </div>

            {showNewPassword ? (
              <form
                className="space-y-4 animate-fade-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResetPassword();
                }}
              >
                <p className="text-center text-sm text-muted-foreground">Defina sua nova senha.</p>
                <FloatingInput id="new-pw" label="Nova senha" type="password" icon={Lock} value={newPassword} onChange={setNewPassword} required />
                <FloatingInput id="confirm-pw" label="Confirmar nova senha" type="password" icon={Lock} value={confirmPassword} onChange={setConfirmPassword} required />
                <SubmitButton loading={isSubmitting}>Redefinir senha</SubmitButton>
              </form>
            ) : (
              <form
                className="space-y-6 animate-fade-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleVerifyOtp();
                }}
              >
                <p className="text-sm text-muted-foreground text-center">
                  Enviamos um código de 6 dígitos para <strong className="text-foreground">{otpEmail}</strong>
                </p>
                <OtpCodeInput value={otpCode} onChange={setOtpCode} />
                <SubmitButton loading={isSubmitting}>Verificar código</SubmitButton>
              </form>
            )}

            <button
              type="button"
              onClick={handleBackFromOtp}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="hidden lg:block lg:w-[55%] xl:w-[58%] p-3"><AuthBrandPanel /></div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center lg:items-start gap-1">
            <TyposLogo size="md" showCredit />
            <p className="text-sm text-muted-foreground">Sistema de Gestão Comercial</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-5 animate-fade-in">
              <form onSubmit={handleLogin} className="space-y-4">
                <FloatingInput id="login-email" label="Email" type="email" icon={Mail} value={loginEmail} onChange={setLoginEmail} required />
                <FloatingInput id="login-password" label="Senha" type="password" icon={Lock} value={loginPassword} onChange={setLoginPassword} required />
                <SubmitButton loading={isSubmitting}>Entrar</SubmitButton>
                <button type="button" onClick={() => setShowForgot(true)} className="w-full text-center text-sm text-primary hover:text-primary/80 transition-colors duration-200 font-medium">Esqueci minha senha</button>
              </form>
              {showForgot && (
                <form
                  className="space-y-4 animate-fade-in border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleForgotPassword();
                  }}
                >
                  <p className="text-sm text-muted-foreground">Informe seu email para receber o código de redefinição.</p>
                  <FloatingInput id="forgot-email" label="Email" type="email" icon={Mail} value={forgotEmail} onChange={setForgotEmail} required />
                  <SubmitButton loading={isSendingReset}>Enviar código</SubmitButton>
                  <button type="button" onClick={() => setShowForgot(false)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">Voltar ao login</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
