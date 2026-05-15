import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, X, TrendingUp, Target, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const salesTips = [
  { icon: Target, tip: 'Ofereça produtos complementares: quem compra sofá pode precisar de almofadas.' },
  { icon: TrendingUp, tip: 'Pergunte se o cliente já conhece nossas condições de crediário.' },
  { icon: Star, tip: 'Chame o cliente pelo nome — cria conexão e aumenta a confiança.' },
  { icon: Target, tip: 'Demonstre o produto em uso. O cliente precisa se imaginar com ele.' },
  { icon: TrendingUp, tip: 'Apresente 3 opções: econômica, intermediária e premium.' },
  { icon: Star, tip: 'Após a venda, agradeça e peça indicação. Isso gera novas vendas!' },
];

export function SellerTips() {
  const { user, currentStore, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [mySalesToday, setMySalesToday] = useState(0);
  const [myRevenueToday, setMyRevenueToday] = useState(0);

  const isSeller = userRole === 'seller';

  useEffect(() => {
    if (isSeller && user && currentStore) loadMyStats();
  }, [user, currentStore, isSeller]);

  const loadMyStats = async () => {
    if (!user || !currentStore) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('sales').select('id, total')
      .eq('store_id', currentStore.id).eq('seller_id', user.id)
      .eq('status', 'paid').gte('created_at', today);
    setMySalesToday(data?.length || 0);
    setMyRevenueToday(data?.reduce((s, d) => s + Number(d.total), 0) || 0);
  };

  if (!isSeller) return null;

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const randomTip = salesTips[Math.floor(Math.random() * salesTips.length)];

  return (
    <>
      {/* Floating Action Button - bottom-right, not overlapping essential buttons */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 lg:bottom-6"
        aria-label="Dicas de vendas"
      >
        {open ? <X className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
      </button>

      {/* Tips Panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm lg:bottom-20">
          <Card className="shadow-2xl border-primary/20">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" /> Dicas de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              {/* My Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Vendas Hoje</p>
                  <p className="text-lg font-bold text-primary">{mySalesToday}</p>
                </div>
                <div className="rounded-lg bg-green-500/10 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(myRevenueToday)}</p>
                </div>
              </div>

              {/* Random Tip */}
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <div className="flex items-start gap-2">
                  <randomTip.icon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">{randomTip.tip}</p>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setOpen(false); loadMyStats(); }}>
                Atualizar dados
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
