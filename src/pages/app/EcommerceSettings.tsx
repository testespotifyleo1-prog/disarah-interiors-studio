import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ExternalLink, Store, Copy, Check, Upload, Image, Palette, Plus, Trash2, Tag, FileText, MapPin, Menu, ChevronDown, ChevronUp, GripVertical, Truck, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InlineBanner {
  id: string;
  image_url: string;
  title: string;
  link_url?: string;
}

interface CategoryItem {
  id: string;
  name: string;
  icon_url?: string;
}

interface HeaderMenuItem {
  name: string;
  icon?: string;
  category?: string;
  children?: { name: string; category: string }[];
}

interface DeliveryOption {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
}

interface PaymentMethodOption {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
}

export default function EcommerceSettings() {
  const { currentAccount, currentStore } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingInline, setUploadingInline] = useState<string | null>(null);
  const [uploadingCatIcon, setUploadingCatIcon] = useState<string | null>(null);
  const [erpCategories, setErpCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    slug: '',
    is_enabled: false,
    store_name: '',
    banner_text: 'Bem-vindo à nossa loja!',
    hero_subtitle: '',
    description: '',
    whatsapp_number: '',
    primary_color: '#1e40af',
    logo_url: '',
    banner_image_url: '',
    show_prices: true,
    show_whatsapp_button: true,
    inline_banners: [] as InlineBanner[],
    categories: [] as CategoryItem[],
    header_menu: [] as HeaderMenuItem[],
    delivery_options: [
      { id: 'delivery', name: 'Entrega', description: 'Entrega no endereço informado', price: 0, is_active: true },
      { id: 'pickup', name: 'Retirada na loja', description: 'Retire seu pedido na loja', price: 0, is_active: true },
    ] as DeliveryOption[],
    payment_methods: [
      { id: 'pix', name: 'PIX', icon: '💳', is_active: true },
      { id: 'card', name: 'Cartão', icon: '💳', is_active: true },
      { id: 'cash', name: 'Dinheiro', icon: '💵', is_active: true },
      { id: 'crediario', name: 'Crediário', icon: '📋', is_active: false },
    ] as PaymentMethodOption[],
    footer_cnpj: '',
    footer_address: '',
    footer_phone: '',
    footer_email: '',
    policy_privacy: '',
    policy_terms: '',
    policy_purchase: '',
    policy_exchange: '',
    policy_shipping: '',
    about_us: '',
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => { if (currentStore) loadSettings(); }, [currentStore]);
  useEffect(() => { if (currentAccount) loadErpCategories(); }, [currentAccount]);

  const loadErpCategories = async () => {
    if (!currentAccount) return;
    const { data } = await supabase.from('products').select('category').eq('account_id', currentAccount.id).not('category', 'is', null);
    const unique = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
    setErpCategories(unique.sort());
  };

  const loadSettings = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data } = await supabase.from('store_ecommerce_settings').select('*').eq('store_id', currentStore.id).maybeSingle();
    if (data) {
      setSettingsId(data.id);
      setSettings({
        slug: data.slug || '',
        is_enabled: data.is_enabled || false,
        store_name: data.store_name || '',
        banner_text: data.banner_text || '',
        hero_subtitle: (data as any).hero_subtitle || '',
        description: data.description || '',
        whatsapp_number: data.whatsapp_number || '',
        primary_color: data.primary_color || '#1e40af',
        logo_url: data.logo_url || '',
        banner_image_url: (data as any).banner_image_url || '',
        show_prices: (data as any).show_prices ?? true,
        show_whatsapp_button: (data as any).show_whatsapp_button ?? true,
        inline_banners: ((data as any).inline_banners as InlineBanner[]) || [],
        categories: ((data as any).categories as CategoryItem[]) || [],
        header_menu: ((data as any).header_menu as HeaderMenuItem[]) || [],
        delivery_options: ((data as any).delivery_options as DeliveryOption[]) || [
          { id: 'delivery', name: 'Entrega', description: 'Entrega no endereço informado', price: 0, is_active: true },
          { id: 'pickup', name: 'Retirada na loja', description: 'Retire seu pedido na loja', price: 0, is_active: true },
        ],
        payment_methods: ((data as any).payment_methods as PaymentMethodOption[]) || [
          { id: 'pix', name: 'PIX', icon: '💳', is_active: true },
          { id: 'card', name: 'Cartão', icon: '💳', is_active: true },
          { id: 'cash', name: 'Dinheiro', icon: '💵', is_active: true },
          { id: 'crediario', name: 'Crediário', icon: '📋', is_active: false },
        ],
        footer_cnpj: (data as any).footer_cnpj || '',
        footer_address: (data as any).footer_address || '',
        footer_phone: (data as any).footer_phone || '',
        footer_email: (data as any).footer_email || '',
        policy_privacy: (data as any).policy_privacy || '',
        policy_terms: (data as any).policy_terms || '',
        policy_purchase: (data as any).policy_purchase || '',
        policy_exchange: (data as any).policy_exchange || '',
        policy_shipping: (data as any).policy_shipping || '',
        about_us: (data as any).about_us || '',
      });
    } else {
      const slug = currentStore.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setSettings(prev => ({ ...prev, slug, store_name: currentStore.name }));
    }
    setLoading(false);
  };

  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!currentStore) return;
    const setter = type === 'logo' ? setUploadingLogo : setUploadingBanner;
    setter(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentStore.id}/${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      const field = type === 'logo' ? 'logo_url' : 'banner_image_url';
      setSettings(prev => ({ ...prev, [field]: urlData.publicUrl }));
      toast({ title: `${type === 'logo' ? 'Logo' : 'Banner'} carregado!` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: e.message });
    } finally { setter(false); }
  };

  const handleInlineBannerUpload = async (file: File, bannerId: string) => {
    if (!currentStore) return;
    setUploadingInline(bannerId);
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentStore.id}/inline-${bannerId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      setSettings(prev => ({
        ...prev,
        inline_banners: prev.inline_banners.map(b => b.id === bannerId ? { ...b, image_url: urlData.publicUrl } : b),
      }));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: e.message });
    } finally { setUploadingInline(null); }
  };



  const addInlineBanner = () => {
    setSettings(prev => ({ ...prev, inline_banners: [...prev.inline_banners, { id: crypto.randomUUID(), image_url: '', title: '', link_url: '' }] }));
  };

  const removeInlineBanner = (id: string) => {
    setSettings(prev => ({ ...prev, inline_banners: prev.inline_banners.filter(b => b.id !== id) }));
  };

  const updateInlineBanner = (id: string, field: string, value: string) => {
    setSettings(prev => ({ ...prev, inline_banners: prev.inline_banners.map(b => b.id === id ? { ...b, [field]: value } : b) }));
  };

  const updateCategoryIcon = (name: string, icon_url: string) => {
    setSettings(prev => {
      const existing = prev.categories.find(c => c.name === name);
      if (existing) {
        return { ...prev, categories: prev.categories.map(c => c.name === name ? { ...c, icon_url } : c) };
      }
      return { ...prev, categories: [...prev.categories, { id: crypto.randomUUID(), name, icon_url }] };
    });
  };

  const saveSettings = async () => {
    if (!currentStore || !currentAccount || !settings.slug.trim()) {
      toast({ variant: 'destructive', title: 'Slug é obrigatório' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store_id: currentStore.id,
        account_id: currentAccount.id,
        slug: settings.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        is_enabled: settings.is_enabled,
        store_name: settings.store_name || currentStore.name,
        banner_text: settings.banner_text,
        description: settings.description,
        whatsapp_number: settings.whatsapp_number,
        primary_color: settings.primary_color,
        logo_url: settings.logo_url || null,
        banner_image_url: settings.banner_image_url || null,
        hero_subtitle: settings.hero_subtitle || null,
        show_prices: settings.show_prices,
        show_whatsapp_button: settings.show_whatsapp_button,
        inline_banners: settings.inline_banners as any,
        categories: settings.categories as any,
        header_menu: settings.header_menu as any,
        delivery_options: settings.delivery_options as any,
        payment_methods: settings.payment_methods as any,
        footer_cnpj: settings.footer_cnpj || null,
        footer_address: settings.footer_address || null,
        footer_phone: settings.footer_phone || null,
        footer_email: settings.footer_email || null,
        policy_privacy: settings.policy_privacy || null,
        policy_terms: settings.policy_terms || null,
        policy_purchase: settings.policy_purchase || null,
        policy_exchange: settings.policy_exchange || null,
        policy_shipping: settings.policy_shipping || null,
        about_us: settings.about_us || null,
        updated_at: new Date().toISOString(),
      };
      if (settingsId) {
        const { error } = await supabase.from('store_ecommerce_settings').update(payload as any).eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('store_ecommerce_settings').insert(payload as any).select().single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      toast({ title: 'Configurações salvas!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const storeUrl = `${window.location.origin}/loja/${settings.slug}`;
  const copyUrl = async () => { await navigator.clipboard.writeText(storeUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Loja Online (E-commerce)</h1>
        <p className="text-sm text-muted-foreground">Configure sua vitrine virtual para clientes</p>
      </div>

      {settings.is_enabled && settings.slug && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Badge className="bg-green-500 text-white">Ativo</Badge>
            <span className="text-sm font-medium truncate flex-1">{storeUrl}</span>
            <Button variant="outline" size="sm" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Abrir</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Configurações Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label className="text-sm font-medium">Loja ativa</Label><p className="text-xs text-muted-foreground">Habilitar vitrine pública</p></div>
            <Switch checked={settings.is_enabled} onCheckedChange={v => setSettings(prev => ({ ...prev, is_enabled: v }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Slug (URL)</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/loja/</span>
                <Input value={settings.slug} onChange={e => setSettings(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="minha-loja" />
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Nome da Loja</Label><Input value={settings.store_name} onChange={e => setSettings(prev => ({ ...prev, store_name: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={settings.whatsapp_number} onChange={e => setSettings(prev => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="5511999999999" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Cor principal</Label>
              <div className="flex gap-2">
                <Input type="color" value={settings.primary_color} onChange={e => setSettings(prev => ({ ...prev, primary_color: e.target.value }))} className="w-12 h-9 p-1" />
                <Input value={settings.primary_color} onChange={e => setSettings(prev => ({ ...prev, primary_color: e.target.value }))} className="flex-1" />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3"><Switch checked={settings.show_prices} onCheckedChange={v => setSettings(prev => ({ ...prev, show_prices: v }))} /><Label className="text-xs">Mostrar preços</Label></div>
            <div className="flex items-center gap-3"><Switch checked={settings.show_whatsapp_button} onCheckedChange={v => setSettings(prev => ({ ...prev, show_whatsapp_button: v }))} /><Label className="text-xs">Botão WhatsApp</Label></div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Identity */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Identidade Visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Logo da Loja</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url ? <img src={settings.logo_url} alt="Logo" className="max-h-16 max-w-[200px] rounded-xl object-contain border p-1 bg-background" /> : <div className="h-16 w-32 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed"><Store className="h-6 w-6 text-muted-foreground" /></div>}
              <Button variant="outline" size="sm" className="relative" disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                {uploadingLogo ? 'Enviando...' : 'Upload Logo'}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')} />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Banner Principal (Hero)</Label>
            {settings.banner_image_url ? (
              <div className="relative rounded-xl overflow-hidden border h-40">
                <img src={settings.banner_image_url} alt="Banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <Button variant="secondary" size="sm" className="relative">
                    <Upload className="h-4 w-4 mr-1" /> Trocar
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative border-2 border-dashed rounded-xl h-40 flex items-center justify-center bg-muted/30">
                <div className="text-center"><Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" /><span className="text-xs text-muted-foreground">Clique para adicionar</span></div>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploadingBanner} onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories from ERP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Categorias com Ícones</CardTitle>
          <p className="text-xs text-muted-foreground">As categorias vêm do cadastro de produtos do ERP. Adicione uma foto para cada uma.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {erpCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria encontrada. Cadastre categorias nos seus produtos.</p>
          )}
          {erpCategories.map((catName) => {
            const catData = settings.categories.find(c => c.name === catName);
            const iconUrl = catData?.icon_url || '';
            return (
              <div key={catName} className="border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border flex-shrink-0 flex items-center justify-center bg-muted/30">
                    {iconUrl ? (
                      <img src={iconUrl} alt={catName} className="w-full h-full object-cover" />
                    ) : (
                      uploadingCatIcon === catName ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Tag className="h-5 w-5 text-muted-foreground" />
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
                      if (e.target.files?.[0]) {
                        const file = e.target.files[0];
                        (async () => {
                          if (!currentStore) return;
                          setUploadingCatIcon(catName);
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `${currentStore.id}/cat-${Date.now()}.${ext}`;
                            const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
                            if (uploadError) throw uploadError;
                            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
                            updateCategoryIcon(catName, urlData.publicUrl);
                          } catch (err: any) {
                            toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
                          } finally { setUploadingCatIcon(null); }
                        })();
                      }
                    }} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{catName}</p>
                    <Input
                      value={iconUrl}
                      onChange={e => updateCategoryIcon(catName, e.target.value)}
                      placeholder="URL da imagem ou faça upload clicando na foto"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Header Menu */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Menu className="h-5 w-5" /> Menu do Cabeçalho (Desktop)</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Configure o menu de categorias que aparece no topo da loja. Cada item pode ter subcategorias com submenu ao passar o mouse.</p>
            </div>
            <div className="flex gap-2">
              {settings.header_menu.length === 0 && (
                <Button variant="outline" size="sm" onClick={() => {
                  setSettings(prev => ({
                    ...prev,
                    header_menu: [
                      { name: 'Saldão de descontos', icon: 'sale', category: '', children: [] },
                      { name: 'Balões', icon: 'balloon', category: '', children: [] },
                      { name: 'Descartáveis', icon: 'cutlery', category: '', children: [] },
                      { name: 'Temas Sazonais', icon: 'pumpkin', category: '', children: [] },
                      { name: 'Temas Menina', icon: 'girl', category: '', children: [] },
                      { name: 'Temas Menino', icon: 'boy', category: '', children: [] },
                      { name: 'Temas Bebê', icon: 'baby', category: '', children: [] },
                      { name: 'Temas Jovem e Adulto', icon: 'party', category: '', children: [] },
                      { name: 'Lembrancinhas', icon: 'gift', category: '', children: [] },
                      { name: 'Acessórios de festas', icon: 'glasses', category: '', children: [] },
                      { name: 'Velas', icon: 'candle', category: '', children: [] },
                      { name: 'Artigos de decoração', icon: 'decor', category: '', children: [] },
                    ]
                  }));
                }}>Carregar menu padrão</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                setSettings(prev => ({
                  ...prev,
                  header_menu: [...prev.header_menu, { name: '', icon: '', category: '', children: [] }]
                }));
              }}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.header_menu.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item configurado. Clique em "Carregar menu padrão" para começar ou adicione manualmente.</p>
          )}

          {/* Preview bar */}
          {settings.header_menu.length > 0 && (
            <div className="rounded-xl p-3 flex items-center gap-1 overflow-x-auto" style={{ backgroundColor: settings.primary_color || '#ec4899' }}>
              {settings.header_menu.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 px-2 py-1.5 min-w-[70px]">
                  <MenuIconPreview iconKey={item.icon} />
                  <span className="text-[9px] text-white/90 font-semibold text-center leading-tight line-clamp-2 max-w-[65px]">{item.name || '...'}</span>
                </div>
              ))}
            </div>
          )}

          {settings.header_menu.map((menuItem, idx) => (
            <div key={idx} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: settings.primary_color || '#ec4899' }}>
                  <MenuIconPreview iconKey={menuItem.icon} />
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={menuItem.name}
                      onChange={e => {
                        const updated = [...settings.header_menu];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setSettings(prev => ({ ...prev, header_menu: updated }));
                      }}
                      placeholder="Ex: Balões"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ícone</Label>
                    <select
                      value={menuItem.icon || ''}
                      onChange={e => {
                        const updated = [...settings.header_menu];
                        updated[idx] = { ...updated[idx], icon: e.target.value };
                        setSettings(prev => ({ ...prev, header_menu: updated }));
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Nenhum</option>
                      <option value="sale">🏷️ Saldão/Promoção</option>
                      <option value="balloon">🎈 Balões</option>
                      <option value="cutlery">🍴 Descartáveis</option>
                      <option value="pumpkin">🎃 Temas Sazonais</option>
                      <option value="girl">👧 Temas Menina</option>
                      <option value="boy">👦 Temas Menino</option>
                      <option value="baby">👶 Temas Bebê</option>
                      <option value="party">🎉 Jovem/Adulto</option>
                      <option value="gift">🎁 Lembrancinhas</option>
                      <option value="glasses">🥳 Acessórios</option>
                      <option value="candle">🕯️ Velas</option>
                      <option value="decor">✨ Decoração</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria vinculada</Label>
                    <select
                      value={menuItem.category || ''}
                      onChange={e => {
                        const updated = [...settings.header_menu];
                        updated[idx] = { ...updated[idx], category: e.target.value };
                        setSettings(prev => ({ ...prev, header_menu: updated }));
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecionar...</option>
                      {erpCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {idx > 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      const updated = [...settings.header_menu];
                      [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                      setSettings(prev => ({ ...prev, header_menu: updated }));
                    }}><ChevronUp className="h-3 w-3" /></Button>
                  )}
                  {idx < settings.header_menu.length - 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      const updated = [...settings.header_menu];
                      [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                      setSettings(prev => ({ ...prev, header_menu: updated }));
                    }}><ChevronDown className="h-3 w-3" /></Button>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => {
                  setSettings(prev => ({ ...prev, header_menu: prev.header_menu.filter((_, i) => i !== idx) }));
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Subcategories */}
              <div className="pl-12 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Subcategorias (submenu ao passar o mouse)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    const updated = [...settings.header_menu];
                    updated[idx] = { ...updated[idx], children: [...(updated[idx].children || []), { name: '', category: '' }] };
                    setSettings(prev => ({ ...prev, header_menu: updated }));
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Sub
                  </Button>
                </div>
                {(menuItem.children || []).map((child, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <Input
                      value={child.name}
                      onChange={e => {
                        const updated = [...settings.header_menu];
                        const children = [...(updated[idx].children || [])];
                        children[ci] = { ...children[ci], name: e.target.value };
                        updated[idx] = { ...updated[idx], children };
                        setSettings(prev => ({ ...prev, header_menu: updated }));
                      }}
                      placeholder="Nome do submenu"
                      className="flex-1 h-8 text-xs"
                    />
                    <select
                      value={child.category}
                      onChange={e => {
                        const updated = [...settings.header_menu];
                        const children = [...(updated[idx].children || [])];
                        children[ci] = { ...children[ci], category: e.target.value };
                        updated[idx] = { ...updated[idx], children };
                        setSettings(prev => ({ ...prev, header_menu: updated }));
                      }}
                      className="flex h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Categoria...</option>
                      {erpCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      const updated = [...settings.header_menu];
                      updated[idx] = { ...updated[idx], children: (updated[idx].children || []).filter((_, i) => i !== ci) };
                      setSettings(prev => ({ ...prev, header_menu: updated }));
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Inline Banners */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Banners Promocionais</CardTitle>
            <Button variant="outline" size="sm" onClick={addInlineBanner}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Banners aparecem entre as seções de produtos na loja. Adicione vários para criar um carousel animado.</p>
          {settings.inline_banners.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum banner. Adicione banners que aparecerão entre vitrines de produtos.</p>
          )}
          {settings.inline_banners.map((banner) => (
            <div key={banner.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                {banner.image_url ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                    <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                      <Button variant="secondary" size="sm" className="relative">
                        <Upload className="h-4 w-4 mr-1" /> Trocar
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleInlineBannerUpload(e.target.files[0], banner.id)} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30">
                    {uploadingInline === banner.id ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
                      <div className="text-center"><Image className="h-6 w-6 text-muted-foreground mx-auto mb-1" /><span className="text-xs text-muted-foreground">Upload imagem</span></div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleInlineBannerUpload(e.target.files[0], banner.id)} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Título (overlay)</Label><Input value={banner.title} onChange={e => updateInlineBanner(banner.id, 'title', e.target.value)} placeholder="Promoção especial!" /></div>
                <div className="space-y-1 flex items-end gap-2">
                  <div className="flex-1 space-y-1"><Label className="text-xs">Link (opcional)</Label><Input value={banner.link_url || ''} onChange={e => updateInlineBanner(banner.id, 'link_url', e.target.value)} placeholder="https://..." /></div>
                  <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 flex-shrink-0" onClick={() => removeInlineBanner(banner.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delivery Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Opções de Entrega</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Configure as formas de entrega disponíveis no checkout da loja online.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettings(prev => ({
              ...prev,
              delivery_options: [...prev.delivery_options, { id: `custom-${Date.now()}`, name: '', description: '', price: 0, is_active: true }],
            }))}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.delivery_options.map((opt, idx) => (
            <div key={opt.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={opt.is_active} onCheckedChange={v => {
                    const updated = [...settings.delivery_options];
                    updated[idx] = { ...updated[idx], is_active: v };
                    setSettings(prev => ({ ...prev, delivery_options: updated }));
                  }} />
                  <span className={`text-sm font-medium ${opt.is_active ? '' : 'text-muted-foreground line-through'}`}>{opt.name || 'Nova opção'}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                  setSettings(prev => ({ ...prev, delivery_options: prev.delivery_options.filter((_, i) => i !== idx) }));
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input value={opt.name} onChange={e => {
                    const updated = [...settings.delivery_options];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setSettings(prev => ({ ...prev, delivery_options: updated }));
                  }} placeholder="Ex: Entrega expressa" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={opt.description} onChange={e => {
                    const updated = [...settings.delivery_options];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setSettings(prev => ({ ...prev, delivery_options: updated }));
                  }} placeholder="Ex: Entrega em até 2h" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={opt.price} onChange={e => {
                    const updated = [...settings.delivery_options];
                    updated[idx] = { ...updated[idx], price: parseFloat(e.target.value) || 0 };
                    setSettings(prev => ({ ...prev, delivery_options: updated }));
                  }} placeholder="0.00" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Formas de Pagamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Configure as formas de pagamento disponíveis no checkout da loja online.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettings(prev => ({
              ...prev,
              payment_methods: [...prev.payment_methods, { id: `custom-${Date.now()}`, name: '', icon: '💰', is_active: true }],
            }))}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.payment_methods.map((method, idx) => (
            <div key={method.id} className="border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Switch checked={method.is_active} onCheckedChange={v => {
                  const updated = [...settings.payment_methods];
                  updated[idx] = { ...updated[idx], is_active: v };
                  setSettings(prev => ({ ...prev, payment_methods: updated }));
                }} />
                <select
                  value={method.icon}
                  onChange={e => {
                    const updated = [...settings.payment_methods];
                    updated[idx] = { ...updated[idx], icon: e.target.value };
                    setSettings(prev => ({ ...prev, payment_methods: updated }));
                  }}
                  className="flex h-9 w-16 rounded-md border border-input bg-background px-2 text-lg"
                >
                  {['💳', '💵', '📋', '💰', '🏦', '💲', '🪙', '📱'].map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
                <Input
                  value={method.name}
                  onChange={e => {
                    const updated = [...settings.payment_methods];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setSettings(prev => ({ ...prev, payment_methods: updated }));
                  }}
                  placeholder="Nome do método"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => {
                  setSettings(prev => ({ ...prev, payment_methods: prev.payment_methods.filter((_, i) => i !== idx) }));
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Texts */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Textos e Conteúdo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Label className="text-xs">Texto do Banner (destaque principal)</Label><Input value={settings.banner_text} onChange={e => setSettings(prev => ({ ...prev, banner_text: e.target.value }))} placeholder="Confira nossas ofertas!" /></div>
          <div className="space-y-1"><Label className="text-xs">Subtítulo do Hero</Label><Input value={settings.hero_subtitle} onChange={e => setSettings(prev => ({ ...prev, hero_subtitle: e.target.value }))} placeholder="Entrega para todo o Brasil" /></div>
          <div className="space-y-1"><Label className="text-xs">Descrição da Loja</Label><Textarea value={settings.description} onChange={e => setSettings(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Fale sobre sua loja..." /></div>
        </CardContent>
      </Card>

      {/* Footer Settings */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Rodapé da Loja</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Informações exibidas no rodapé da loja online.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-xs">CNPJ</Label><Input value={settings.footer_cnpj} onChange={e => setSettings(prev => ({ ...prev, footer_cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
            <div className="space-y-1"><Label className="text-xs">Telefone / WhatsApp</Label><Input value={settings.footer_phone} onChange={e => setSettings(prev => ({ ...prev, footer_phone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={settings.footer_email} onChange={e => setSettings(prev => ({ ...prev, footer_email: e.target.value }))} placeholder="contato@minhaloja.com" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Endereço completo</Label><Textarea value={settings.footer_address} onChange={e => setSettings(prev => ({ ...prev, footer_address: e.target.value }))} rows={2} placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF - CEP 00000-000" /></div>
        </CardContent>
      </Card>

      {/* Legal Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Páginas Institucionais</CardTitle>
          <p className="text-xs text-muted-foreground">Conteúdo exibido nas páginas legais do rodapé. Deixe em branco para ocultar.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Sobre Nós</Label>
            <Textarea value={settings.about_us} onChange={e => setSettings(prev => ({ ...prev, about_us: e.target.value }))} rows={4} placeholder="Conte a história da sua empresa, missão, valores..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Política de Privacidade</Label>
            <Textarea value={settings.policy_privacy} onChange={e => setSettings(prev => ({ ...prev, policy_privacy: e.target.value }))} rows={6} placeholder="Descreva como os dados dos clientes são coletados, armazenados e utilizados..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Termos de Uso</Label>
            <Textarea value={settings.policy_terms} onChange={e => setSettings(prev => ({ ...prev, policy_terms: e.target.value }))} rows={6} placeholder="Estabeleça os termos e condições de uso do site e dos serviços..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Política de Compra</Label>
            <Textarea value={settings.policy_purchase} onChange={e => setSettings(prev => ({ ...prev, policy_purchase: e.target.value }))} rows={4} placeholder="Descreva as condições de compra, formas de pagamento, prazos..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Política de Troca e Devolução</Label>
            <Textarea value={settings.policy_exchange} onChange={e => setSettings(prev => ({ ...prev, policy_exchange: e.target.value }))} rows={4} placeholder="Informe as condições para troca e devolução de produtos, prazos, documentação..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Política de Envio</Label>
            <Textarea value={settings.policy_shipping} onChange={e => setSettings(prev => ({ ...prev, policy_shipping: e.target.value }))} rows={4} placeholder="Descreva prazos de entrega, regiões atendidas, custos de frete..." />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto" size="lg">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
}

function MenuIconPreview({ iconKey }: { iconKey?: string }) {
  const cls = "w-5 h-5 text-white";
  const svgProps = { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (iconKey) {
    case 'sale': return <svg {...svgProps}><path d="M3 3h18v4H3z"/><path d="M3 7v13a1 1 0 001 1h16a1 1 0 001-1V7"/><path d="M16 10a4 4 0 01-8 0"/><circle cx="18" cy="4" r="3" fill="currentColor" stroke="none"/></svg>;
    case 'balloon': return <svg {...svgProps}><ellipse cx="12" cy="9" rx="5" ry="7"/><path d="M12 16v5"/><path d="M10 21h4"/><path d="M10 16l2 2 2-2"/></svg>;
    case 'cutlery': return <svg {...svgProps}><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 002-2V2"/><path d="M6 2v20"/><path d="M18 2c-1.5 1.5-2 3.5-2 6 0 2.5 2 4 4 4V2"/><path d="M20 12v10"/></svg>;
    case 'pumpkin': return <svg {...svgProps}><path d="M12 3c-1 0-2 .5-2 2"/><path d="M12 5C7 5 3 9 3 14s4 7 9 7 9-2 9-7-4-9-9-9z"/><path d="M9 13l1.5 2L12 13l1.5 2L15 13"/><path d="M9 10h.01M15 10h.01"/></svg>;
    case 'girl': return <svg {...svgProps}><circle cx="12" cy="8" r="5"/><path d="M12 13c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/><path d="M9 4c0-1 1.5-2 3-2s3 1 3 2"/></svg>;
    case 'boy': return <svg {...svgProps}><circle cx="12" cy="8" r="5"/><path d="M12 13c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/><path d="M7 5l3-3M17 5l-3-3"/></svg>;
    case 'baby': return <svg {...svgProps}><circle cx="12" cy="10" r="6"/><path d="M12 16c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/><path d="M9 9h.01M15 9h.01"/><path d="M10 12a2 2 0 004 0"/><path d="M10 4h4"/></svg>;
    case 'party': return <svg {...svgProps}><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="M9 7L6 4M17 14l4-1M20 18l1-3"/><path d="M2 22l4-11 7 7z"/></svg>;
    case 'gift': return <svg {...svgProps}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 010-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 010 5"/></svg>;
    case 'glasses': return <svg {...svgProps}><circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2"/><path d="M3 14l-1-4M21 14l1-4"/><path d="M15 6c-1 2-2 3-3 3s-2-1-3-3"/></svg>;
    case 'candle': return <svg {...svgProps}><rect x="9" y="8" width="6" height="14" rx="1"/><path d="M12 3c-.5 1-1 2-1 3s1 2 1 2 1-1 1-2-0.5-2-1-3z" fill="currentColor"/></svg>;
    case 'decor': return <svg {...svgProps}><path d="M12 2l2 4 4.5.7-3.3 3.1.8 4.5L12 12.2 7.9 14.3l.8-4.5L5.5 6.7 10 6z"/><path d="M5 18h14"/><path d="M7 22h10"/><path d="M12 14v4"/></svg>;
    default:
      if (iconKey) return <span className="text-sm">{iconKey}</span>;
      return <span className="w-5 h-5 rounded bg-white/30 block" />;
  }
}
