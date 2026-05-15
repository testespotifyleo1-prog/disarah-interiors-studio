import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, Copy, QrCode, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

interface MpConfig {
  public_key: string;
  enabled_methods: string[];
  environment?: string;
  credit_fee_percent?: number;
  debit_fee_percent?: number;
}

interface Props {
  mp: MpConfig;
  storeId: string;
  saleId: string;
  amount: number;
  payerEmail: string;
  payerDocument?: string | null;
  primaryColor: string;
  onApproved: () => void;
}

type Tab = 'pix' | 'credit_card' | 'debit_card';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar SDK MP')));
      return;
    }
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar SDK MP'));
    document.head.appendChild(s);
  });
}

export function MercadoPagoStorefrontCheckout({
  mp, storeId, saleId, amount, payerEmail, payerDocument, primaryColor, onApproved,
}: Props) {
  const enabled = mp.enabled_methods || [];
  const initialTab: Tab = enabled.includes('pix') ? 'pix' : enabled.includes('credit_card') ? 'credit_card' : 'debit_card';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sdkReady, setSdkReady] = useState(false);
  const mpRef = useRef<any>(null);

  // PIX state
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; mp_payment_id: string } | null>(null);
  const [paid, setPaid] = useState(false);

  // Card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [docNumber, setDocNumber] = useState((payerDocument || '').replace(/\D/g, ''));
  const [installments, setInstallments] = useState(1);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [installmentsList, setInstallmentsList] = useState<{ installments: number; recommended_message: string }[]>([]);
  const [cardLoading, setCardLoading] = useState(false);

  useEffect(() => {
    loadMpSdk()
      .then(() => {
        try {
          mpRef.current = new window.MercadoPago(mp.public_key, { locale: 'pt-BR' });
          setSdkReady(true);
        } catch (e) {
          console.error('MP init error', e);
          toast.error('Erro ao inicializar Mercado Pago');
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error('Não foi possível carregar o Mercado Pago');
      });
  }, [mp.public_key]);

  // Realtime: ouvir aprovação
  useEffect(() => {
    if (!saleId) return;
    const ch = supabase
      .channel(`mp_pay_${saleId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mp_payments', filter: `sale_id=eq.${saleId}` }, (payload: any) => {
        if (payload.new?.status === 'approved') {
          setPaid(true);
          onApproved();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mp_payments', filter: `sale_id=eq.${saleId}` }, (payload: any) => {
        if (payload.new?.status === 'approved') {
          setPaid(true);
          onApproved();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [saleId, onApproved]);

  // ---------- PIX ----------
  const createPix = async () => {
    setPixLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/mp-create-pix`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId, amount, sale_id: saleId, payer_email: payerEmail, source: 'ecommerce',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX');
      setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, mp_payment_id: data.mp_payment_id });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  };

  const copyPix = async () => {
    if (!pixData?.qr_code) return;
    await navigator.clipboard.writeText(pixData.qr_code);
    toast.success('Código PIX copiado!');
  };

  // ---------- CARD ----------
  // Detect payment_method_id (brand) and load installments when card number has 6+ digits
  useEffect(() => {
    if (!sdkReady || !mpRef.current) return;
    const bin = cardNumber.replace(/\D/g, '').slice(0, 8);
    if (bin.length < 6) { setPaymentMethodId(null); setInstallmentsList([]); return; }

    let cancelled = false;
    (async () => {
      try {
        const pm = await mpRef.current.getPaymentMethods({ bin });
        if (cancelled) return;
        const chosen = pm?.results?.[0];
        if (!chosen) return;
        setPaymentMethodId(chosen.id);
        // For credit, fetch installments
        if (tab === 'credit_card' && chosen.payment_type_id === 'credit_card') {
          const inst = await mpRef.current.getInstallments({ amount: amount.toFixed(2), bin, paymentTypeId: 'credit_card' });
          if (cancelled) return;
          const opts = inst?.[0]?.payer_costs || [];
          setInstallmentsList(opts.map((o: any) => ({ installments: o.installments, recommended_message: o.recommended_message })));
          setIssuerId(inst?.[0]?.issuer?.id ? String(inst[0].issuer.id) : null);
        } else {
          setInstallmentsList([]);
          setIssuerId(null);
        }
      } catch (e) {
        console.error('MP detect error', e);
      }
    })();
    return () => { cancelled = true; };
  }, [cardNumber, tab, sdkReady, amount]);

  const payCard = async () => {
    if (!sdkReady || !mpRef.current) { toast.error('Aguarde o Mercado Pago carregar'); return; }
    if (!cardNumber || !cardName || !cardExpMonth || !cardExpYear || !cardCvv || !docNumber) {
      toast.error('Preencha todos os dados do cartão'); return;
    }
    if (!paymentMethodId) { toast.error('Não foi possível identificar a bandeira do cartão'); return; }

    setCardLoading(true);
    try {
      const tokenRes = await mpRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName: cardName,
        cardExpirationMonth: cardExpMonth.padStart(2, '0'),
        cardExpirationYear: cardExpYear.length === 2 ? `20${cardExpYear}` : cardExpYear,
        securityCode: cardCvv,
        identificationType: docNumber.length > 11 ? 'CNPJ' : 'CPF',
        identificationNumber: docNumber,
      });
      if (!tokenRes?.id) throw new Error('Erro ao tokenizar cartão');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/mp-create-card`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId, amount, sale_id: saleId,
          token: tokenRes.id,
          payment_method_id: paymentMethodId,
          payer_email: payerEmail,
          identification: { type: docNumber.length > 11 ? 'CNPJ' : 'CPF', number: docNumber },
          installments: tab === 'credit_card' ? installments : 1,
          issuer_id: issuerId || undefined,
          method: tab,
          source: 'ecommerce',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pagamento recusado');

      if (data.status === 'approved') {
        setPaid(true);
        onApproved();
      } else if (data.status === 'in_process' || data.status === 'pending') {
        toast.info('Pagamento em análise. Você receberá a confirmação em instantes.');
      } else {
        toast.error(`Pagamento ${data.status_detail || data.status}`);
      }
    } catch (e: any) {
      const msg = Array.isArray(e?.cause) ? e.cause.map((c: any) => c.description || c.code).join(', ') : (e?.message || 'Erro ao processar cartão');
      toast.error(msg);
    } finally {
      setCardLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="bg-white rounded-2xl border-2 border-green-500 p-6 text-center space-y-3">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
        <h3 className="text-xl font-bold text-gray-800">Pagamento aprovado!</h3>
        <p className="text-sm text-gray-600">Seu pedido está sendo processado.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [];
  if (enabled.includes('pix')) tabs.push({ id: 'pix', label: 'PIX', icon: QrCode });
  if (enabled.includes('credit_card')) tabs.push({ id: 'credit_card', label: 'Crédito', icon: CreditCard });
  if (enabled.includes('debit_card')) tabs.push({ id: 'debit_card', label: 'Débito', icon: CreditCard });

  return (
    <div className="bg-white rounded-2xl border p-4 space-y-4">
      <div className="flex gap-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition border-2 ${active ? 'text-white' : 'text-gray-600 bg-white border-gray-200'}`}
              style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'pix' && (
        <div className="space-y-3">
          {!pixData && (
            <button
              onClick={createPix}
              disabled={pixLoading}
              className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {pixLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
              {pixLoading ? 'Gerando QR Code...' : 'Gerar PIX'}
            </button>
          )}
          {pixData && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-56 h-56 border rounded-xl"
                />
              </div>
              <p className="text-center text-xs text-gray-500">Escaneie o QR Code com o app do seu banco</p>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Ou use o código copia e cola:</p>
                <p className="text-[10px] font-mono break-all text-gray-700">{pixData.qr_code}</p>
              </div>
              <button onClick={copyPix} className="w-full h-11 rounded-xl border-2 font-semibold flex items-center justify-center gap-2" style={{ borderColor: primaryColor, color: primaryColor }}>
                <Copy className="h-4 w-4" /> Copiar código PIX
              </button>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do pagamento...
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'credit_card' || tab === 'debit_card') && (
        <div className="space-y-3">
          <input
            type="text" inputMode="numeric" placeholder="Número do cartão"
            value={cardNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 19);
              setCardNumber(v.replace(/(\d{4})/g, '$1 ').trim());
            }}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
          <input
            type="text" placeholder="Nome impresso no cartão"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text" inputMode="numeric" placeholder="MM" maxLength={2}
              value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, ''))}
              className="h-12 px-3 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400"
            />
            <input
              type="text" inputMode="numeric" placeholder="AAAA" maxLength={4}
              value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, ''))}
              className="h-12 px-3 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400"
            />
            <input
              type="text" inputMode="numeric" placeholder="CVV" maxLength={4}
              value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
              className="h-12 px-3 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400"
            />
          </div>
          <input
            type="text" inputMode="numeric" placeholder="CPF/CNPJ do titular"
            value={docNumber} onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ''))}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
          {tab === 'credit_card' && installmentsList.length > 0 && (
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-gray-400"
            >
              {installmentsList.map((o) => (
                <option key={o.installments} value={o.installments}>{o.recommended_message}</option>
              ))}
            </select>
          )}
          <button
            onClick={payCard} disabled={cardLoading || !sdkReady}
            className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            {cardLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
            {cardLoading ? 'Processando...' : `Pagar ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
          </button>
          <p className="text-[10px] text-gray-400 text-center">🔒 Seus dados são processados com segurança pelo Mercado Pago</p>
        </div>
      )}
    </div>
  );
}
