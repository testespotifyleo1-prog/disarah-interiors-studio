import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Banknote, Smartphone, BookOpen, Building2, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { PaymentMethod, CardType } from '@/types/database';

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export interface NewPaymentEntry {
  id: string;
  method: PaymentMethod;
  amount: number;
  cardType?: CardType;
  cardBrand?: string;
  installments: number;
  cardFeePercent: number;
  financeiraRetention?: number;
  financeiraInstallments?: number;
  crediarioFirstDate?: string;
}

const cardBrands = [
  'Visa', 'MasterCard', 'Elo', 'Hipercard', 'American Express',
  'Diners', 'Discover', 'Aura', 'JCB', 'UnionPay', 'Maestro',
];

interface Props {
  remaining: number;
  entries: NewPaymentEntry[];
  onAdd: (entry: NewPaymentEntry) => void;
  onRemove: (id: string) => void;
  allowCrediario?: boolean;
  customerSelected?: boolean;
}

const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function MultiPaymentForm({ remaining, entries, onAdd, onRemove, allowCrediario, customerSelected }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(0);
  const [cardType, setCardType] = useState<CardType>('debit');
  const [cardBrand, setCardBrand] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [finRetention, setFinRetention] = useState(0);
  const [finInstallments, setFinInstallments] = useState(1);
  const [credFirstDate, setCredFirstDate] = useState('');
  const [credInstallments, setCredInstallments] = useState(1);

  const getLabel = (m: PaymentMethod, e?: NewPaymentEntry) => {
    if (m === 'pix') return 'Pix';
    if (m === 'cash') return 'Dinheiro';
    if (m === 'card') return `Cartão ${e?.cardType === 'credit' ? 'Crédito' : 'Débito'}${e?.cardBrand ? ` (${e.cardBrand})` : ''}`;
    if (m === 'crediario') return 'Crediário';
    if (m === 'financeira') return 'Financeira';
    return m;
  };

  const handleAdd = () => {
    if (amount <= 0) return;
    if (method === 'card' && !cardBrand) return;
    if (method === 'crediario') {
      if (!customerSelected || !credFirstDate) return;
      if (credFirstDate < todayISO()) {
        toast({ variant: 'destructive', title: 'Data inválida', description: 'A 1ª parcela do crediário não pode ter data anterior a hoje.' });
        return;
      }
    }
    onAdd({
      id: crypto.randomUUID(),
      method,
      amount,
      cardType: method === 'card' ? cardType : undefined,
      cardBrand: method === 'card' ? cardBrand : undefined,
      installments: method === 'card' && cardType === 'credit' ? installments : method === 'financeira' ? finInstallments : method === 'crediario' ? credInstallments : 1,
      cardFeePercent: method === 'card' ? cardFeePercent : method === 'financeira' ? finRetention : 0,
      financeiraRetention: method === 'financeira' ? finRetention : undefined,
      financeiraInstallments: method === 'financeira' ? finInstallments : undefined,
      crediarioFirstDate: method === 'crediario' ? credFirstDate : undefined,
    });
    setAmount(0);
    setCardBrand('');
    setCredFirstDate('');
  };

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(e => (
            <div key={e.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{getLabel(e.method, e)}</span>
                {e.installments > 1 && <span className="text-xs text-muted-foreground ml-1">({e.installments}x)</span>}
              </div>
              <span className="font-medium mr-2">{fc(e.amount)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(e.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {remaining > 0.01 && (
        <div className="space-y-2 rounded-lg border p-2">
          <div className="grid grid-cols-5 gap-1">
            {([['pix', Smartphone, 'Pix'], ['cash', Banknote, 'Dinheiro'], ['card', CreditCard, 'Cartão'], ['crediario', BookOpen, 'Crediário'], ['financeira', Building2, 'Financ.']] as const).map(([m, Icon, label]) => (
              <Button key={m} variant={method === m ? 'default' : 'outline'} className="flex flex-col gap-0.5 h-auto py-1.5 px-1" onClick={() => setMethod(m as PaymentMethod)} size="sm">
                <Icon className="h-3.5 w-3.5" /><span className="text-[9px]">{label}</span>
              </Button>
            ))}
          </div>

          <div>
            <Label className="text-xs">Valor</Label>
            <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} min={0.01} max={remaining} step={0.01} className="h-8" />
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAmount(Math.round(remaining * 100) / 100)}>
              Restante ({fc(remaining)})
            </Button>
          </div>

          {method === 'card' && (
            <>
              <div className="grid grid-cols-2 gap-1">
                <Button variant={cardType === 'debit' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => { setCardType('debit'); setInstallments(1); }}>Débito</Button>
                <Button variant={cardType === 'credit' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setCardType('credit')}>Crédito</Button>
              </div>
              <Select value={cardBrand} onValueChange={setCardBrand}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Bandeira" /></SelectTrigger>
                <SelectContent>{cardBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
              {cardType === 'credit' && (
                <Select value={String(installments)} onValueChange={v => setInstallments(Number(v))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 20 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(amount / n)}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <div>
                <Label className="text-xs">Taxa (%)</Label>
                <Input type="number" value={cardFeePercent} onChange={e => setCardFeePercent(Number(e.target.value))} min={0} max={100} step={0.01} className="h-7" />
              </div>
            </>
          )}

          {method === 'financeira' && (
            <>
              <div>
                <Label className="text-xs">Retenção (%)</Label>
                <Input type="number" value={finRetention} onChange={e => setFinRetention(Number(e.target.value))} min={0} max={100} step={0.01} className="h-7" />
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Select value={String(finInstallments)} onValueChange={v => setFinInstallments(Number(v))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 24 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(amount / n)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {method === 'crediario' && (
            <>
              {!customerSelected ? (
                <p className="text-xs text-destructive">Vincule um cliente para usar crediário.</p>
              ) : !allowCrediario ? (
                <p className="text-xs text-destructive">Cliente sem crediário autorizado.</p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Data 1º pagamento *</Label>
                    <Input type="date" value={credFirstDate} min={todayISO()} onChange={e => setCredFirstDate(e.target.value)} className="h-7" />
                  </div>
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={String(credInstallments)} onValueChange={v => setCredInstallments(Number(v))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x de {fc(amount / n)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          )}

          <Button variant="secondary" size="sm" className="w-full h-8" onClick={handleAdd} disabled={amount <= 0 || amount > remaining + 0.01}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar pagamento
          </Button>
        </div>
      )}
    </div>
  );
}
